"""ユーザーAPIのルーティングを定義するファイル。"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.schemas import UserCreate, UserLogin, UserResponse

router = APIRouter(prefix="/users", tags=["users"])


@router.post("", response_model=UserResponse, status_code=201)
def create_user(
    user: UserCreate,
    db: Session = Depends(get_db),
) -> User:
    db_user = User(name=user.name)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


@router.post("/login", response_model=UserResponse)
def login_user(
    user: UserLogin,
    db: Session = Depends(get_db),
) -> User:
    db_user = db.query(User).filter(User.name == user.name).order_by(User.id).first()
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found")

    return db_user
