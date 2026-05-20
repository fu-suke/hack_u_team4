"""貼り付け前に回答する問題APIのルーティングを定義するファイル。"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Question
from app.schemas import (
    QuestionCheckResponse,
    QuestionResponse,
    QuestionWithAnswerResponse,
)

router = APIRouter(prefix="/questions", tags=["questions"])


def answer_to_tokens(choices: list[str], answer: list[int]) -> list[str] | None:
    tokens: list[str] = []
    for choice_id in answer:
        index = choice_id - 1
        if index < 0 or index >= len(choices):
            return None
        tokens.append(choices[index])
    return tokens


def is_correct_answer(question: QuestionWithAnswerResponse, answer: list[int]) -> bool:
    answer_tokens = answer_to_tokens(question.choices, answer)
    if answer_tokens is None:
        return False

    for correct_answer in question.answers:
        if answer_tokens == answer_to_tokens(question.choices, correct_answer):
            return True
    return False


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
    "/random",
    response_model=QuestionResponse,
)
def get_question(db: Session = Depends(get_db)) -> QuestionResponse:
    question = db.query(Question).order_by(func.random()).first()
    if question is None:
        raise HTTPException(status_code=404, detail="No questions found")

    return QuestionWithAnswerResponse.model_validate(question)
