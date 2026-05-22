from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    answer_logs: Mapped[list["AnswerLog"]] = relationship(back_populates="user")


class Question(Base):
    __tablename__ = "questions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    prompt: Mapped[str] = mapped_column(String, nullable=False)
    category: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    difficulty: Mapped[int] = mapped_column(Integer, nullable=False)
    choices: Mapped[list[str]] = mapped_column(JSON, nullable=False)
    answers: Mapped[list[list[int]]] = mapped_column(JSON, nullable=False)
    tutorial: Mapped[str] = mapped_column(String, nullable=False)
    sample_output: Mapped[str] = mapped_column(String, nullable=False, default="")
    virus_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    answer_logs: Mapped[list["AnswerLog"]] = relationship(back_populates="question")


class AnswerLog(Base):
    __tablename__ = "answer_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    question_id: Mapped[int] = mapped_column(ForeignKey("questions.id"), nullable=False)
    is_correct: Mapped[bool] = mapped_column(Boolean, nullable=False)
    answered_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    user: Mapped["User"] = relationship(back_populates="answer_logs")
    question: Mapped["Question"] = relationship(back_populates="answer_logs")
