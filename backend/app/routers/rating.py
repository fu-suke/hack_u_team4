"""ユーザーの level から rating を返すAPIのルーティングを定義するファイル。"""

from collections import defaultdict
from datetime import datetime, time, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import AnswerLog, Question, User
from app.schemas import RatingHistoryPoint, RatingHistoryResponse, RatingResponse

router = APIRouter(prefix="/rating", tags=["rating"])
RATING_HISTORY_DAYS = 30
RATING_ALPHA = 5
RATING_DECAY = 0.998


def calculate_rating(level: float) -> float:
    rating = 1000 * (level - 0.5)
    return max(0, min(3000, rating))


def format_rating(rating: float) -> str:
    if rating.is_integer():
        return str(int(rating))
    return str(rating)


def calculate_rating_level(
    stats_by_difficulty: dict[int, dict[str, float]],
    alpha: int = RATING_ALPHA,
) -> float:
    level = 0.5
    for difficulty in (1, 2, 3):
        stats = stats_by_difficulty.get(
            difficulty,
            {"weighted_correct": 0.0, "weighted_total": 0.0},
        )
        level += stats["weighted_correct"] / (stats["weighted_total"] + alpha)
    return level


def rating_from_stats(stats_by_difficulty: dict[int, dict[str, float]]) -> str:
    level = calculate_rating_level(stats_by_difficulty)
    return format_rating(calculate_rating(level))


def latest_answer_at_before(
    db: Session,
    user_id: int,
    end_at: datetime,
) -> datetime | None:
    row = (
        db.query(AnswerLog.answered_at)
        .filter(
            AnswerLog.user_id == user_id,
            AnswerLog.answered_at < end_at,
        )
        .order_by(AnswerLog.answered_at.desc())
        .first()
    )
    return row[0] if row else None


def answer_stats_until_rating_at(
    db: Session,
    user_id: int,
    rating_at: datetime | None,
) -> dict[int, dict[str, float]]:
    if rating_at is None:
        return {}

    rows = (
        db.query(AnswerLog.is_correct, Question.difficulty)
        .join(Question, Question.id == AnswerLog.question_id)
        .filter(
            AnswerLog.user_id == user_id,
            AnswerLog.answered_at <= rating_at,
        )
        .order_by(AnswerLog.answered_at.desc())
        .all()
    )

    stats_by_difficulty: dict[int, dict[str, float]] = defaultdict(
        lambda: {"weighted_correct": 0.0, "weighted_total": 0.0}
    )
    for index, (is_correct, difficulty) in enumerate(rows):
        weight = RATING_DECAY**index
        stats_by_difficulty[difficulty]["weighted_total"] += weight
        if is_correct:
            stats_by_difficulty[difficulty]["weighted_correct"] += weight

    return stats_by_difficulty


def rating_from_anchor(db: Session, user_id: int, rating_at: datetime | None) -> str:
    return rating_from_stats(answer_stats_until_rating_at(db, user_id, rating_at))


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

    now = datetime.now()
    return RatingResponse(
        rating=rating_from_anchor(db, user_id, latest_answer_at_before(db, user_id, now))
    )


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
    first_day_end_at = datetime.combine(first_day + timedelta(days=1), time.min)
    has_answer_by_first_day = latest_answer_at_before(db, user_id, first_day_end_at) is not None

    ratings: list[RatingHistoryPoint] = []
    for offset in range(RATING_HISTORY_DAYS):
        day = first_day + timedelta(days=offset)
        day_key = day.isoformat()
        should_include_day = (
            day == today
            or day_key in answered_dates
            or (day == first_day and has_answer_by_first_day)
        )
        if not should_include_day:
            continue

        if day == today:
            rating_end_at = now
        else:
            rating_end_at = datetime.combine(day + timedelta(days=1), time.min)

        ratings.append(
            RatingHistoryPoint(
                date=day_key,
                rating=rating_from_anchor(
                    db,
                    user_id,
                    latest_answer_at_before(db, user_id, rating_end_at),
                ),
            )
        )

    return RatingHistoryResponse(ratings=ratings)
