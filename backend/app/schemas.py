import re
from datetime import datetime

from pydantic import BaseModel, field_validator

_PIN_RE = re.compile(r"^\d{4}$")


def _validate_pin(v: str) -> str:
    if not _PIN_RE.match(v):
        raise ValueError("パスワードは4桁の数字で入力してください")
    return v


class UserCreate(BaseModel):
    name: str
    password: str

    @field_validator("password")
    @classmethod
    def password_must_be_4digits(cls, v: str) -> str:
        return _validate_pin(v)


class UserLogin(BaseModel):
    name: str
    password: str

    @field_validator("password")
    @classmethod
    def password_must_be_4digits(cls, v: str) -> str:
        return _validate_pin(v)


class UserResponse(BaseModel):
    id: int
    name: str
    created_at: datetime

    model_config = {"from_attributes": True}


class QuestionCreate(BaseModel):
    prompt: str
    category: list[str]
    difficulty: int
    choices: list[str]
    answers: list[list[int]]
    tutorial: str


class QuestionResponse(BaseModel):
    id: int
    difficulty: int
    prompt: str
    choices: list[str]
    tutorial: str
    sample_output: str

    model_config = {"from_attributes": True}


class QuestionWithAnswerResponse(QuestionResponse):
    category: list[str]
    answers: list[list[int]]


class QuestionCheckResponse(BaseModel):
    is_correct: bool


class RatingResponse(BaseModel):
    rating: str


class RatingHistoryPoint(BaseModel):
    date: str
    rating: str


class RatingHistoryResponse(BaseModel):
    ratings: list[RatingHistoryPoint]


class VirusQuestionUpdate(BaseModel):
    question_id: int


class VirusQuestionResponse(BaseModel):
    question_id: int
    virus_count: int


class AnswerLogCreate(BaseModel):
    user_id: int
    question_id: int
    is_correct: bool


class AnswerLogResponse(BaseModel):
    id: int
    user_id: int
    question_id: int
    is_correct: bool
    answered_at: datetime

    model_config = {"from_attributes": True}
