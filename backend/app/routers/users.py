"""ユーザーAPIのルーティングを定義するファイル。"""

import hashlib
import os

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.schemas import UserCreate, UserLogin, UserResponse

router = APIRouter(prefix="/users", tags=["users"])


def _hash_password(password: str) -> str:
    """パスワードをランダムsalt付きSHA-256でハッシュ化する。"""
    salt = os.urandom(16).hex()
    digest = hashlib.sha256((salt + password).encode()).hexdigest()
    return f"{salt}:{digest}"


def _verify_password(password: str, stored_hash: str) -> bool:
    """保存済みハッシュとパスワードを照合する。"""
    try:
        salt, digest = stored_hash.split(":", 1)
    except ValueError:
        return False
    expected = hashlib.sha256((salt + password).encode()).hexdigest()
    return expected == digest


@router.post("", response_model=UserResponse, status_code=201)
def create_user(
    user: UserCreate,
    db: Session = Depends(get_db),
) -> User:
    db_user = User(name=user.name, password_hash=_hash_password(user.password))
    db.add(db_user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="そのユーザー名はすでに使われています")
    db.refresh(db_user)
    return db_user


@router.post("/login", response_model=UserResponse)
def login_user(
    user: UserLogin,
    db: Session = Depends(get_db),
) -> User:
    db_user = db.query(User).filter(User.name == user.name).first()
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found")
    if not _verify_password(user.password, db_user.password_hash):
        raise HTTPException(status_code=401, detail="パスワードが正しくありません")
    return db_user
