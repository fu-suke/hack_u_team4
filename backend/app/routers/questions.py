"""貼り付け前に回答する問題APIのルーティングを定義するファイル。"""

from fastapi import APIRouter

router = APIRouter(prefix="/questions", tags=["questions"])


@router.get("/sample")
def get_sample_question() -> dict[str, int | str | list[str] | list[list[int]]]:
    return {
        "id": 1,
        "question": "隠しファイルを含めて、long format でファイル一覧を表示するコマンドに並び替えてください。",
        "options": ["ls", "-l", "-a"],
        "answers": [
            [1, 2, 3],
            [1, 3, 2],
        ],
    }
