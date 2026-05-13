"""貼り付け前に回答する問題APIのルーティングを定義するファイル。"""

from fastapi import APIRouter

router = APIRouter(prefix="/questions", tags=["questions"])


@router.get("/sample")
def get_sample_question() -> dict[str, str]:
    return {
        "id": "sample",
        "question": "これはサンプル問題。具体的な問題は後で追加予定。",
    }
