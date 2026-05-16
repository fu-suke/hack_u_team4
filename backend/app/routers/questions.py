"""貼り付け前に回答する問題APIのルーティングを定義するファイル。"""

import random

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

SAMPLE_QUESTIONS: list[QuestionWithAnswerResponse] = [
    QuestionWithAnswerResponse(
        id=1001,
        prompt="隠しファイルを含めて、long format でファイル一覧を表示する。",
        category=["ls"],
        difficulty=2,
        choices=["ls", "-l", "-a", "-h"],
        answers=[[1, 2, 3], [1, 3, 2]],
        tutorial="`ls` はファイル一覧を表示するコマンド。`-l` は詳細形式、`-a` は隠しファイルを含めるオプション。`-l` と `-a` はどちらの順番でも同じ意味。",
    ),
    QuestionWithAnswerResponse(
        id=1002,
        prompt="カレントディレクトリに `logs` ディレクトリを作成する。",
        category=["mkdir"],
        difficulty=1,
        choices=["mkdir", "logs", "touch"],
        answers=[[1, 2]],
        tutorial="`mkdir` はディレクトリを作成するコマンド。作成したいディレクトリ名 `logs` を後ろに指定するため、正しい並びは `mkdir logs`。",
    ),
    QuestionWithAnswerResponse(
        id=1003,
        prompt="カレントディレクトリ配下から拡張子 `.log` のファイルを検索する。",
        category=["find"],
        difficulty=2,
        choices=["find", ".", "-name", '"*.log"', "*.log", "grep"],
        answers=[[1, 2, 3, 4]],
        tutorial='`find` はファイルを検索するコマンド。`.` はカレントディレクトリ配下を表し、`-name "*.log"` で名前が `.log` で終わるファイルを検索できる。',
    ),
]


def is_correct_answer(question: QuestionWithAnswerResponse, answer: list[int]) -> bool:
    return answer in question.answers


def find_sample_question(question_id: int) -> QuestionWithAnswerResponse | None:
    return next(
        (question for question in SAMPLE_QUESTIONS if question.id == question_id),
        None,
    )


@router.get(
    "/sample",
    response_model=QuestionResponse,
)
def get_sample_question() -> QuestionResponse:
    return random.choice(SAMPLE_QUESTIONS)


@router.get("/check", response_model=QuestionCheckResponse)
def check_question_answer(
    id: int,
    answer: list[int] = Query(default=[]),
    db: Session = Depends(get_db),
) -> QuestionCheckResponse:
    question = find_sample_question(id)
    if question is None:
        db_question = db.get(Question, id)
        if db_question is None:
            raise HTTPException(status_code=404, detail="Question not found")
        question = QuestionWithAnswerResponse.model_validate(db_question)

    return QuestionCheckResponse(is_correct=is_correct_answer(question, answer))


@router.get(
    "",
    response_model=QuestionResponse,
)
def get_question(db: Session = Depends(get_db)) -> QuestionResponse:
    question = db.query(Question).order_by(func.random()).first()
    if question is None:
        raise HTTPException(status_code=404, detail="No questions found")

    return QuestionWithAnswerResponse.model_validate(question)
