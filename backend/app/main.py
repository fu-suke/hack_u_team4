"""強制クイズAPIを起動するFastAPIアプリ。"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine
from app.models import AnswerLog, Question, User  # noqa: F401 — ensure models are registered
from app.routers import answer_logs, questions, users

Base.metadata.create_all(bind=engine)

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


@app.get("/")
def read_root() -> dict[str, str]:
    return {"message": "Linux Virus Backend is running"}


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}
