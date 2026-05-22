"""初期データ投入スクリプト。users / questions / answer_logs を一括投入する。"""

import sys
from pathlib import Path

import yaml

from app.database import Base, SessionLocal, engine
from app.models import AnswerLog, Question, User  # noqa: F401 — register models

BASE = Path(__file__).parent
QUESTIONS_YAML = BASE / "questions.yaml"
SAMPLE_USERS_YAML = BASE / "sample_users.yaml"
SAMPLE_LOGS_YAML = BASE / "sample_logs.yaml"


def load_users() -> list[User]:
    return [User(id=1, name="ゲスト")]


def load_sample_users(path: Path) -> list[User]:
    """デモ用ユーザーを YAML から読み込む。"""
    with open(path, encoding="utf-8") as f:
        rows = yaml.safe_load(f)
    return [User(id=row["id"], name=row["name"]) for row in rows]


def load_sample_logs(path: Path) -> list[AnswerLog]:
    """デモ用回答ログを YAML から読み込む。"""
    from datetime import datetime

    with open(path, encoding="utf-8") as f:
        rows = yaml.safe_load(f)
    return [
        AnswerLog(
            user_id=row["user_id"],
            question_id=row["question_id"],
            is_correct=row["is_correct"],
            answered_at=datetime.fromisoformat(row["answered_at"]),
        )
        for row in rows
    ]


def load_questions(path: Path) -> list[Question]:
    with open(path, encoding="utf-8") as f:
        rows = yaml.safe_load(f)

    if not isinstance(rows, list):
        raise ValueError(f"{path} must contain a list of questions")

    # 感染機能の動作確認用ダミーデータ（130問に 0〜30 の範囲で散らばせて付与）
    _dummy_virus_counts = {
        1: 3,   2: 18,  3: 1,   4: 12,  5: 27,
        6: 5,   7: 0,   8: 9,   9: 22,  10: 4,
        11: 14, 12: 2,  13: 30, 14: 7,  15: 0,
        16: 19, 17: 11, 18: 6,  19: 25, 20: 1,
        21: 8,  22: 0,  23: 16, 24: 3,  25: 28,
        26: 10, 27: 5,  28: 20, 29: 0,  30: 13,
        31: 2,  32: 24, 33: 7,  34: 0,  35: 17,
        36: 4,  37: 29, 38: 11, 39: 1,  40: 8,
        41: 0,  42: 21, 43: 6,  44: 15, 45: 3,
        46: 26, 47: 9,  48: 0,  49: 18, 50: 5,
        51: 12, 52: 23, 53: 0,  54: 7,  55: 30,
        56: 2,  57: 14, 58: 0,  59: 19, 60: 6,
        61: 27, 62: 10, 63: 0,  64: 4,  65: 22,
        66: 1,  67: 16, 68: 8,  69: 0,  70: 25,
        71: 3,  72: 13, 73: 20, 74: 0,  75: 9,
        76: 28, 77: 5,  78: 0,  79: 17, 80: 11,
        81: 2,  82: 24, 83: 6,  84: 0,  85: 15,
        86: 29, 87: 4,  88: 21, 89: 0,  90: 8,
        91: 18, 92: 1,  93: 26, 94: 12, 95: 0,
        96: 7,  97: 23, 98: 3,  99: 30, 100: 10,
        101: 0, 102: 16, 103: 5, 104: 20, 105: 2,
        106: 27, 107: 9, 108: 0, 109: 14, 110: 6,
        111: 22, 112: 1, 113: 19, 114: 0, 115: 11,
        116: 25, 117: 4, 118: 13, 119: 0, 120: 28,
        121: 7,  122: 17, 123: 3, 124: 24, 125: 0,
        126: 8,  127: 21, 128: 5, 129: 15, 130: 2,
    }

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

        sample_users = load_sample_users(SAMPLE_USERS_YAML)
        db.add_all(sample_users)
        db.flush()

        logs = load_sample_logs(SAMPLE_LOGS_YAML)
        db.add_all(logs)

        db.commit()
        print(f"users={len(users) + len(sample_users)}, questions={len(questions)}, answer_logs={len(logs)} 件を投入しました。")
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

        sample_users = load_sample_users(SAMPLE_USERS_YAML)
        db.add_all(sample_users)
        db.flush()

        logs = load_sample_logs(SAMPLE_LOGS_YAML)
        db.add_all(logs)

        db.commit()
        print(f"users={len(users) + len(sample_users)}, questions={len(questions)}, answer_logs={len(logs)} 件を投入しました（テーブルを再作成済み）。")
    finally:
        db.close()


if __name__ == "__main__":
    if "--force" in sys.argv:
        seed_force()
    else:
        seed()
