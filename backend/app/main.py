"""Paste操作時の強制クイズAPIを起動するFastAPIアプリ。"""

from fastapi import FastAPI

from app.routers import questions

app = FastAPI(title="Paste Guard Backend")

app.include_router(questions.router)


@app.get("/")
def read_root() -> dict[str, str]:
    return {"message": "Paste Guard Backend is running"}


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}
