"""回答ログAPIのルーティングを定義するファイル。"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import AnswerLog, Question, User
from app.schemas import AnswerLogCreate, AnswerLogResponse, StreakResponse

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


@router.get("/streak", response_model=StreakResponse)
def get_streak(user_id: int, db: Session = Depends(get_db)) -> dict:
    """ユーザーの現在の連続正解数を返す。

    Args:
        user_id: 対象ユーザーのID。
        db: データベースセッション。

    Returns:
        streak: 直近から遡った連続正解数。不正解が出た時点で打ち切り。
    """
    if db.get(User, user_id) is None:
        raise HTTPException(status_code=404, detail="User not found")
    logs = (
        db.query(AnswerLog)
        .filter(AnswerLog.user_id == user_id)
        .order_by(AnswerLog.answered_at.desc())
        .all()
    )
    streak = 0
    for log in logs:
        if log.is_correct:
            streak += 1
        else:
            break
    return {"streak": streak}
