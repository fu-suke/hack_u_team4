"""ユーザーの level から rating を返すAPIのルーティングを定義するファイル。"""

from collections import defaultdict
from datetime import datetime, time, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import AnswerLog, Question, User
from app.routers.questions import calculate_user_level
from app.schemas import RatingHistoryPoint, RatingHistoryResponse, RatingResponse

router = APIRouter(prefix="/rating", tags=["rating"])
RATING_HISTORY_DAYS = 30


def calculate_rating(level: float) -> float:
    rating = 1000 * (level - 0.5)
    return max(0, min(3000, rating))


def format_rating(rating: float) -> str:
    if rating.is_integer():
        return str(int(rating))
    return str(rating)


def rating_from_stats(stats_by_difficulty: dict[int, dict[str, int]]) -> str:
    level = calculate_user_level(stats_by_difficulty)
    return format_rating(calculate_rating(level))


def answer_stats_until(
    db: Session,
    user_id: int,
    end_at: datetime,
) -> dict[int, dict[str, int]]:
    rows = (
        db.query(AnswerLog.is_correct, Question.difficulty)
        .join(Question, Question.id == AnswerLog.question_id)
        .filter(
            AnswerLog.user_id == user_id,
            AnswerLog.answered_at < end_at,
        )
        .all()
    )

    stats_by_difficulty: dict[int, dict[str, int]] = defaultdict(lambda: {"correct": 0, "total": 0})
    for is_correct, difficulty in rows:
        stats_by_difficulty[difficulty]["total"] += 1
        if is_correct:
            stats_by_difficulty[difficulty]["correct"] += 1

    return stats_by_difficulty


def dates_with_answers(db: Session, user_id: int, start_at: datetime, end_at: datetime) -> set[str]:
    rows = (
        db.query(AnswerLog.answered_at)
        .filter(
            AnswerLog.user_id == user_id,
            AnswerLog.answered_at >= start_at,
            AnswerLog.answered_at < end_at,
        )
        .all()
    )
    return {answered_at.date().isoformat() for (answered_at,) in rows}


@router.get("", response_model=RatingResponse)
def get_rating(
    user_id: int,
    db: Session = Depends(get_db),
) -> RatingResponse:
    if db.get(User, user_id) is None:
        raise HTTPException(status_code=404, detail="User not found")

    return RatingResponse(rating=rating_from_stats(answer_stats_until(db, user_id, datetime.now())))


@router.get("/history", response_model=RatingHistoryResponse)
def get_rating_history(
    user_id: int,
    db: Session = Depends(get_db),
) -> RatingHistoryResponse:
    if db.get(User, user_id) is None:
        raise HTTPException(status_code=404, detail="User not found")

    now = datetime.now()
    today = now.date()
    first_day = today - timedelta(days=RATING_HISTORY_DAYS - 1)
    start_at = datetime.combine(first_day, time.min)
    answered_dates = dates_with_answers(db, user_id, start_at, now)

    ratings: list[RatingHistoryPoint] = []
    for offset in range(RATING_HISTORY_DAYS):
        day = first_day + timedelta(days=offset)
        day_key = day.isoformat()
        if day not in (first_day, today) and day_key not in answered_dates:
            continue

        if day == today:
            rating_end_at = now
        else:
            rating_end_at = datetime.combine(day + timedelta(days=1), time.min)

        ratings.append(
            RatingHistoryPoint(
                date=day_key,
                rating=rating_from_stats(answer_stats_until(db, user_id, rating_end_at)),
            )
        )

    return RatingHistoryResponse(ratings=ratings)
