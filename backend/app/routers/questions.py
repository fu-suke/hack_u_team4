"""貼り付け前に回答する問題APIのルーティングを定義するファイル。"""

import random
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from math import erf, sqrt
from typing import TypeVar

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import AnswerLog, Question, User
from app.schemas import (
    QuestionCheckResponse,
    QuestionResponse,
    QuestionWithAnswerResponse,
)

router = APIRouter(prefix="/questions", tags=["questions"])

PERSONALIZE_ALPHA = 5
PERSONALIZE_LOOKBACK_DAYS = 7
T = TypeVar("T")


def answer_to_tokens(choices: list[str], answer: list[int]) -> list[str] | None:
    tokens: list[str] = []
    for choice_id in answer:
        index = choice_id - 1
        if index < 0 or index >= len(choices):
            return None
        tokens.append(choices[index])
    return tokens


def question_response(question: Question) -> QuestionResponse:
    correct_answer = ""
    if question.answers:
        answer_tokens = answer_to_tokens(question.choices, question.answers[0])
        if answer_tokens is not None:
            correct_answer = " ".join(answer_tokens)

    return QuestionResponse(
        id=question.id,
        difficulty=question.difficulty,
        prompt=question.prompt,
        choices=question.choices,
        tutorial=question.tutorial,
        sample_output=question.sample_output,
        correct_answer=correct_answer,
    )


def is_correct_answer(question: QuestionWithAnswerResponse, answer: list[int]) -> bool:
    answer_tokens = answer_to_tokens(question.choices, answer)
    if answer_tokens is None:
        return False

    for correct_answer in question.answers:
        if answer_tokens == answer_to_tokens(question.choices, correct_answer):
            return True
    return False


def normal_cdf(x: float) -> float:
    return 0.5 * (1 + erf(x / sqrt(2)))


def calculate_user_level(
    stats_by_difficulty: dict[int, dict[str, int]],
    alpha: int = PERSONALIZE_ALPHA,
) -> float:
    level = 0.5
    for difficulty in (1, 2, 3):
        stats = stats_by_difficulty.get(difficulty, {"correct": 0, "total": 0})
        level += (stats["correct"] + alpha) / (stats["total"] + 2 * alpha)
    return level


def difficulty_probabilities(level: float) -> dict[int, float]:
    p1 = normal_cdf(1.5 - level)
    p2 = normal_cdf(2.5 - level) - p1
    p3 = 1 - normal_cdf(2.5 - level)

    return {1: p1, 2: p2, 3: p3}


def weighted_choice(items: list[T], weights: list[float]) -> T:
    total_weight = sum(weights)
    if total_weight <= 0:
        return random.choice(items)

    target = random.uniform(0, total_weight)
    cumulative = 0.0
    for item, weight in zip(items, weights):
        cumulative += weight
        if target <= cumulative:
            return item

    return items[-1]


def choose_personalized_difficulty(db: Session, level: float) -> int:
    available_rows = (
        db.query(Question.difficulty, func.count(Question.id))
        .group_by(Question.difficulty)
        .all()
    )
    available_difficulties = {difficulty for difficulty, count in available_rows if count > 0}
    probabilities = difficulty_probabilities(level)
    choices = [difficulty for difficulty in (1, 2, 3) if difficulty in available_difficulties]

    if not choices:
        raise HTTPException(status_code=404, detail="No questions found")

    return weighted_choice(choices, [probabilities[difficulty] for difficulty in choices])


def recent_answer_stats(
    db: Session,
    user_id: int,
) -> tuple[dict[int, dict[str, int]], dict[int, dict[str, int]]]:
    since = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(
        days=PERSONALIZE_LOOKBACK_DAYS
    )
    rows = (
        db.query(AnswerLog.question_id, AnswerLog.is_correct, Question.difficulty)
        .join(Question, Question.id == AnswerLog.question_id)
        .filter(AnswerLog.user_id == user_id, AnswerLog.answered_at >= since)
        .all()
    )

    stats_by_difficulty: dict[int, dict[str, int]] = defaultdict(lambda: {"correct": 0, "total": 0})
    stats_by_question: dict[int, dict[str, int]] = defaultdict(lambda: {"correct": 0, "total": 0})
    for question_id, is_correct, difficulty in rows:
        stats_by_difficulty[difficulty]["total"] += 1
        stats_by_question[question_id]["total"] += 1
        if is_correct:
            stats_by_difficulty[difficulty]["correct"] += 1
            stats_by_question[question_id]["correct"] += 1

    return stats_by_difficulty, stats_by_question


@router.get("/check", response_model=QuestionCheckResponse)
def check_question_answer(
    id: int,
    answer: list[int] = Query(default=[]),
    db: Session = Depends(get_db),
) -> QuestionCheckResponse:
    db_question = db.get(Question, id)
    if db_question is None:
        raise HTTPException(status_code=404, detail="Question not found")
    question = QuestionWithAnswerResponse.model_validate(db_question)

    return QuestionCheckResponse(is_correct=is_correct_answer(question, answer))


@router.get(
    "/personalize",
    response_model=QuestionResponse,
)
def get_personalized_question(
    user_id: int,
    db: Session = Depends(get_db),
) -> QuestionResponse:
    if db.get(User, user_id) is None:
        raise HTTPException(status_code=404, detail="User not found")

    stats_by_difficulty, stats_by_question = recent_answer_stats(db, user_id)
    level = calculate_user_level(stats_by_difficulty)
    difficulty = choose_personalized_difficulty(db, level)
    questions = db.query(Question).filter(Question.difficulty == difficulty).all()
    if not questions:
        raise HTTPException(status_code=404, detail="No questions found")

    weights = []
    for question in questions:
        stats = stats_by_question.get(question.id, {"correct": 0, "total": 0})
        correct_rate = (stats["correct"] + PERSONALIZE_ALPHA) / (
            stats["total"] + 2 * PERSONALIZE_ALPHA
        )
        weights.append(1 - correct_rate)

    question = weighted_choice(questions, weights)
    return question_response(question)


@router.get(
    "/by-command",
    response_model=QuestionResponse,
)
def get_question_by_command(
    command: str,
    db: Session = Depends(get_db),
) -> QuestionResponse:
    normalized_command = command.strip().lower()
    if not normalized_command:
        raise HTTPException(status_code=404, detail="No questions found")

    questions = [
        question
        for question in db.query(Question).all()
        if normalized_command in {str(category).lower() for category in question.category}
    ]
    if not questions:
        raise HTTPException(status_code=404, detail="No questions found")

    return question_response(random.choice(questions))


@router.get(
    "/random",
    response_model=QuestionResponse,
)
def get_question(db: Session = Depends(get_db)) -> QuestionResponse:
    question = db.query(Question).order_by(func.random()).first()
    if question is None:
        raise HTTPException(status_code=404, detail="No questions found")

    return question_response(question)
