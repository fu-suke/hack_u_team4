"""強制クイズAPIを起動するFastAPIアプリ。"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.database import Base, DATABASE_URL, engine
from app.models import AnswerLog, Question, User  # noqa: F401 — ensure models are registered
from app.routers import answer_logs, questions, users, virus

Base.metadata.create_all(bind=engine)

# SQLite のみ: 既存DBに virus_count カラムが欠けている場合の後付けマイグレーション
if DATABASE_URL.startswith("sqlite"):
    with engine.connect() as _conn:
        _cols = [row[1] for row in _conn.execute(text("PRAGMA table_info(questions)"))]
        if "virus_count" not in _cols:
            _conn.execute(text("ALTER TABLE questions ADD COLUMN virus_count INTEGER NOT NULL DEFAULT 0"))
            _conn.commit()

app = FastAPI(title="Linux Virus Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

app.include_router(answer_logs.router)
app.include_router(questions.router)
app.include_router(users.router)
app.include_router(virus.router)


@app.get("/")
def read_root() -> dict[str, str]:
    return {"message": "Linux Virus Backend is running"}


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}
