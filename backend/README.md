## Backend

Linux Virus の macOS 常駐バックエンド。

## API

| Method | Path | 入力 | 出力 | 説明 |
| --- | --- | --- | --- | --- |
| `GET` | `/` | なし | `{"message": "Linux Virus Backend is running"}` | APIの起動確認 |
| `GET` | `/health` | なし | `{"status": "ok"}` | ヘルスチェック |
| `POST` | `/users` | `{"name": string}` | `{"id": number, "name": string, "created_at": string}` | ユーザーを登録する |
| `POST` | `/users/login` | `{"name": string}` | `{"id": number, "name": string, "created_at": string}` | ユーザー名でログインする |
| `GET` | `/questions/random` | なし | `{"id": number, "difficulty": number, "prompt": string, "choices": string[], "tutorial": string}` | DB から問題をランダムに1問返す。`choices` は DB 格納時の元順序で返し、シャッフルはフロント側で行う。`answers` は返さない。問題がない場合は `404` |
| `GET` | `/questions/check?id=...&answer=..&answer=..` | query: `id`, `answer` | `{"is_correct": boolean}` | `id` は問題 ID。`answer` はユーザが並べた選択肢の元 ID 配列で、繰り返し指定する。DB の複数正解パターンと比較して判定し、ログは記録しない |
| `POST` | `/answer_logs` | `{"user_id": number, "question_id": number, "is_correct": boolean}` | `{"id": number, "user_id": number, "question_id": number, "is_correct": boolean, "answered_at": string}` | ユーザ ID、問題 ID、初回判定時の正誤を回答ログとして登録する。初回かどうかはフロント側で判定し、バックエンドはリクエストが来たら記録する |

## 実行

```bash
uv sync --all-packages
uv run --directory backend uvicorn app.main:app --reload
```

起動後、以下で確認可能。

```bash
curl http://127.0.0.1:8000/health
```

ユーザーを登録する例。
`id` はバックエンドが自動で割り当てる。

```bash
curl -X POST http://127.0.0.1:8000/users \
  -H "Content-Type: application/json" \
  -d '{"name": "山田太郎"}'
```

ユーザー名でログインする例。

```bash
curl -X POST http://127.0.0.1:8000/users/login \
  -H "Content-Type: application/json" \
  -d '{"name": "山田太郎"}'
```

回答を判定する例。
選択した選択肢番号を順番に `answer` として指定する。

```bash
curl "http://127.0.0.1:8000/questions/check?id=1&answer=1"
```

回答ログを登録する例。
ログインしていない場合は、デフォルトユーザーとして `user_id: 0` を指定する。

```bash
curl -X POST http://127.0.0.1:8000/answer_logs \
  -H "Content-Type: application/json" \
  -d '{"user_id": 0, "question_id": 1, "is_correct": true}'
```


## データベース

SQLite を使用。DB ファイルは `backend/app.db` に自動生成される。

### 初期化

**サーバー起動時に自動でテーブルが作成される**ため、手動マイグレーションは不要。

環境構築時は以下のシードコマンドで `app/questions.yaml` の問題データとゲストユーザーを投入する。

```bash
uv run --directory backend python seed.py
```

questions テーブルにすでにデータがある場合はスキップされる。
データをリセットして再投入したい場合は `--force` を付ける。

```bash
uv run --directory backend python seed.py --force
```

### スキーマ確認

```bash
sqlite3 backend/app.db ".schema"
```

### 対話モードでクエリを実行する

```bash
sqlite3 -column -header backend/app.db
```

起動すると `sqlite>` プロンプトが表示される。`.quit` で終了。

```
sqlite> SELECT id, difficulty, category, prompt FROM questions LIMIT 5;
id  difficulty  category   prompt
--  ----------  ---------  --------------------------------------------------------
1   1           ["pwd"]    カレントディレクトリの絶対パスを表示する。
2   1           ["ls"]     カレントディレクトリのファイル一覧を表示する。
3   1           ["cd"]     1つ上のディレクトリへ移動する。
4   1           ["mkdir"]  カレントディレクトリに `logs` ディレクトリを作成する。
5   1           ["touch"]  カレントディレクトリに空ファイル `memo.txt` を作成する。

sqlite> .quit
```
