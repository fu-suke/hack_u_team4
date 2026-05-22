"""初期データ投入スクリプト。users / questions / answer_logs を一括投入する。"""

import sys
from pathlib import Path

import yaml

from app.database import Base, SessionLocal, engine
from app.models import AnswerLog, Question, User  # noqa: F401 — register models

BASE = Path(__file__).parent
QUESTIONS_YAML = BASE / "questions.yaml"


def load_users() -> list[User]:
    return [User(id=1, name="ゲスト")]


def load_questions(path: Path) -> list[Question]:
    with open(path, encoding="utf-8") as f:
        rows = yaml.safe_load(f)

    if not isinstance(rows, list):
        raise ValueError(f"{path} must contain a list of questions")

    # 感染機能の動作確認用ダミーデータ（i=1〜5 に virus_count を付与）
    _dummy_virus_counts = {1: 3, 2: 7, 3: 1, 4: 12, 5: 5}

    questions: list[Question] = []
    for i, row in enumerate(rows, start=1):
        if not isinstance(row, dict):
            raise ValueError(f"{path} question #{i} must be a mapping")

        questions.append(
            Question(
                id=i,
                prompt=row["prompt"],
                category=row["category"],
                difficulty=int(row["difficulty"]),
                choices=row["choices"],
                answers=row["answers"],
                tutorial=row.get("tutorial") or "",
                sample_output=row.get("sample_output") or "",
                virus_count=_dummy_virus_counts.get(i, 0),
            )
        )

    return questions


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

        users = load_users()
        db.add_all(users)
        db.flush()

        questions = load_questions(QUESTIONS_YAML)
        db.add_all(questions)
        db.flush()

        logs: list[AnswerLog] = []
        db.add_all(logs)

        db.commit()
        print(f"users={len(users)}, questions={len(questions)}, answer_logs={len(logs)} 件を投入しました。")
    finally:
        db.close()


def seed_force() -> None:
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        users = load_users()
        db.add_all(users)
        db.flush()

        questions = load_questions(QUESTIONS_YAML)
        db.add_all(questions)
        db.flush()

        logs: list[AnswerLog] = []
        db.add_all(logs)

        db.commit()
        print(f"users={len(users)}, questions={len(questions)}, answer_logs={len(logs)} 件を投入しました（テーブルを再作成済み）。")
    finally:
        db.close()


if __name__ == "__main__":
    if "--force" in sys.argv:
        seed_force()
    else:
        seed()
