"""Virus question API routes."""

import random

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Question
from app.schemas import QuestionResponse, VirusQuestionResponse, VirusQuestionUpdate

router = APIRouter(prefix="/virus", tags=["virus"])


@router.get("", response_model=QuestionResponse)
def get_virus_question(db: Session = Depends(get_db)) -> QuestionResponse:
    questions = db.query(Question).filter(Question.virus_count > 0).all()
    total_count = sum(question.virus_count for question in questions)
    if total_count <= 0:
        raise HTTPException(status_code=404, detail="No virus questions found")

    target = random.randrange(total_count)
    cumulative = 0
    for question in questions:
        cumulative += question.virus_count
        if target < cumulative:
            return QuestionResponse.model_validate(question)

    return QuestionResponse.model_validate(questions[-1])


@router.post("/increase", response_model=VirusQuestionResponse)
def increase_virus_question(
    payload: VirusQuestionUpdate,
    db: Session = Depends(get_db),
) -> VirusQuestionResponse:
    question = db.get(Question, payload.question_id)
    if question is None:
        raise HTTPException(status_code=404, detail="Question not found")

    question.virus_count += 1
    db.commit()
    db.refresh(question)

    return VirusQuestionResponse(question_id=question.id, virus_count=question.virus_count)


@router.post("/decrease", response_model=VirusQuestionResponse)
def decrease_virus_question(
    payload: VirusQuestionUpdate,
    db: Session = Depends(get_db),
) -> VirusQuestionResponse:
    question = db.get(Question, payload.question_id)
    if question is None:
        raise HTTPException(status_code=404, detail="Question not found")

    question.virus_count = max(0, question.virus_count - 1)
    db.commit()
    db.refresh(question)

    return VirusQuestionResponse(question_id=question.id, virus_count=question.virus_count)
