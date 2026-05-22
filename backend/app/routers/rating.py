"""ユーザーの level から rating を返すAPIのルーティングを定義するファイル。"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.routers.questions import calculate_user_level, recent_answer_stats
from app.schemas import RatingResponse

router = APIRouter(prefix="/rating", tags=["rating"])


def calculate_rating(level: float) -> float:
    rating = 1000 * (level - 0.5)
    return max(0, min(3000, rating))


def format_rating(rating: float) -> str:
    if rating.is_integer():
        return str(int(rating))
    return str(rating)


@router.get("", response_model=RatingResponse)
def get_rating(
    user_id: int,
    db: Session = Depends(get_db),
) -> RatingResponse:
    if db.get(User, user_id) is None:
        raise HTTPException(status_code=404, detail="User not found")

    stats_by_difficulty, _ = recent_answer_stats(db, user_id)
    level = calculate_user_level(stats_by_difficulty)
    rating = calculate_rating(level)
    return RatingResponse(rating=format_rating(rating))
