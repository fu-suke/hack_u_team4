"""初期データ投入スクリプト。users / questions / answer_logs を一括投入する。"""

import csv
import json
import sys
from datetime import datetime
from pathlib import Path

from app.database import Base, SessionLocal, engine
from app.models import AnswerLog, Question, User  # noqa: F401 — register models

BASE = Path(__file__).parent
QUESTIONS_TSV = BASE / "sample_questions.tsv"
USERS_TSV = BASE / "sample_users.tsv"
ANSWER_LOGS_TSV = BASE / "sample_answer_logs.tsv"
SEED_COUNT = 20


def _parse_dt(s: str) -> datetime:
    return datetime.strptime(s, "%Y-%m-%d %H:%M:%S")


def load_users(path: Path) -> list[User]:
    users = []
    with open(path, encoding="utf-8", newline="") as f:
        for row in csv.DictReader(f, delimiter="\t"):
            users.append(User(name=row["name"], created_at=_parse_dt(row["created_at"])))
    return users


def load_questions(path: Path) -> list[Question]:
    questions = []
    with open(path, encoding="utf-8", newline="") as f:
        for i, row in enumerate(csv.DictReader(f, delimiter="\t")):
            if i >= SEED_COUNT:
                break
            questions.append(
                Question(
                    prompt=row["prompt"],
                    category=json.loads(row["category"]),
                    difficulty=int(row["difficulty"]),
                    choices=json.loads(row["choices"]),
                    answers=json.loads(row["answers"]),
                    tutorial=row.get("turorial") or "",  # TSV のスペルミスに合わせる。未入力は空文字
                )
            )
    return questions


def load_answer_logs(path: Path) -> list[AnswerLog]:
    logs = []
    with open(path, encoding="utf-8", newline="") as f:
        for row in csv.DictReader(f, delimiter="\t"):
            logs.append(
                AnswerLog(
                    user_id=int(row["user_id"]),
                    question_id=int(row["question_id"]),
                    is_correct=bool(int(row["is_correct"])),
                    answered_at=_parse_dt(row["answered_at"]),
                )
            )
    return logs


def seed() -> None:
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        if db.query(Question).count() > 0:
            q = db.query(Question).count()
            u = db.query(User).count()
            a = db.query(AnswerLog).count()
            print(f"データがすでに存在するためスキップします（questions={q}, users={u}, answer_logs={a}）。")
            print("強制的に再投入するには --force オプションを使用してください。")
            return

        users = load_users(USERS_TSV)
        db.add_all(users)
        db.flush()

        questions = load_questions(QUESTIONS_TSV)
        db.add_all(questions)
        db.flush()

        logs = load_answer_logs(ANSWER_LOGS_TSV)
        db.add_all(logs)

        db.commit()
        print(f"users={len(users)}, questions={len(questions)}, answer_logs={len(logs)} 件を投入しました。")
    finally:
        db.close()


def seed_force() -> None:
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        db.query(AnswerLog).delete()
        db.query(Question).delete()
        db.query(User).delete()
        db.flush()

        users = load_users(USERS_TSV)
        db.add_all(users)
        db.flush()

        questions = load_questions(QUESTIONS_TSV)
        db.add_all(questions)
        db.flush()

        logs = load_answer_logs(ANSWER_LOGS_TSV)
        db.add_all(logs)

        db.commit()
        print(f"users={len(users)}, questions={len(questions)}, answer_logs={len(logs)} 件を投入しました（既存データを削除済み）。")
    finally:
        db.close()


if __name__ == "__main__":
    if "--force" in sys.argv:
        seed_force()
    else:
        seed()
