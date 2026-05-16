"""回答ログAPIのルーティングを定義するファイル。"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import AnswerLog, Question, User
from app.schemas import AnswerLogCreate, AnswerLogResponse

router = APIRouter(prefix="/answer_logs", tags=["answer_logs"])


@router.post("", response_model=AnswerLogResponse, status_code=201)
def create_answer_log(
    answer_log: AnswerLogCreate,
    db: Session = Depends(get_db),
) -> AnswerLog:
    if db.get(User, answer_log.user_id) is None:
        raise HTTPException(status_code=404, detail="User not found")
    if db.get(Question, answer_log.question_id) is None:
        raise HTTPException(status_code=404, detail="Question not found")

    db_answer_log = AnswerLog(**answer_log.model_dump(exclude_none=True))
    db.add(db_answer_log)

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Answer log already exists") from exc

    db.refresh(db_answer_log)
    return db_answer_log
