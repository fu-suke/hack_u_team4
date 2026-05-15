"""貼り付け前に回答する問題APIのルーティングを定義するファイル。"""

import random

from fastapi import APIRouter

router = APIRouter(prefix="/questions", tags=["questions"])

SAMPLE_QUESTIONS: list[dict[str, str | list[str] | list[list[int]]]] = [
    {
        "prompt": "隠しファイルを含めて、long format でファイル一覧を表示する。",
        "choices": ["ls", "-l", "-a", "-h"],
        "answers": [[1, 2, 3], [1, 3, 2]],
        "tutorial": "`ls` はファイル一覧を表示するコマンド。`-l` は詳細形式、`-a` は隠しファイルを含めるオプション。`-l` と `-a` はどちらの順番でも同じ意味。",
    },
    {
        "prompt": "カレントディレクトリに `logs` ディレクトリを作成する。",
        "choices": ["mkdir", "logs", "touch"],
        "answers": [[1, 2]],
        "tutorial": "`mkdir` はディレクトリを作成するコマンド。作成したいディレクトリ名 `logs` を後ろに指定するため、正しい並びは `mkdir logs`。",
    },
    {
        "prompt": "カレントディレクトリ配下から拡張子 `.log` のファイルを検索する。",
        "choices": ["find", ".", "-name", '"*.log"', "*.log", "grep"],
        "answers": [[1, 2, 3, 4]],
        "tutorial": "`find` はファイルを検索するコマンド。`.` はカレントディレクトリ配下を表し、`-name \"*.log\"` で名前が `.log` で終わるファイルを検索できる。",
    },
]


def shuffle_question_choices(
    question: dict[str, str | list[str] | list[list[int]]],
) -> dict[str, str | list[str] | list[list[int]]]:
    choices = question["choices"]
    answers = question["answers"]
    if not isinstance(choices, list) or not isinstance(answers, list):
        return question

    indexed_choices = list(enumerate(choices, start=1))
    random.shuffle(indexed_choices)

    shuffled_choices = [choice for _, choice in indexed_choices]
    old_to_new_index = {
        old_index: new_index
        for new_index, (old_index, _) in enumerate(indexed_choices, start=1)
    }
    shuffled_answers = [
        [old_to_new_index[old_index] for old_index in answer]
        for answer in answers
    ]

    return {
        **question,
        "choices": shuffled_choices,
        "answers": shuffled_answers,
    }


@router.get("/sample")
def get_sample_question() -> dict[str, str | list[str] | list[list[int]]]:
    return shuffle_question_choices(random.choice(SAMPLE_QUESTIONS))
