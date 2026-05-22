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
| `GET` | `/questions/personalize?user_id=...` | query: `user_id` | `{"id": number, "difficulty": number, "prompt": string, "choices": string[], "tutorial": string}` | ログイン中ユーザーの直近1週間の回答ログからレベルを計算し、正規分布で難易度を決める。難易度決定後、その難易度の問題から誤答率を重みとして1問返す。`answers` は返さない。ユーザーまたは問題が存在しない場合は `404` |
| `GET` | `/rating?user_id=...` | query: `user_id` | `{"rating": string}` | 指定時点までの全回答ログから計算した level を `rating = 1000 × (level - 0.5)` で換算して返す。rating は `0`〜`3000` の範囲に制限する。ユーザーが存在しない場合は `404` |
| `GET` | `/rating/history?user_id=...` | query: `user_id` | `{"ratings": [{"date": string, "rating": string}]}` | 直近30日分の rating 履歴を返す。各日の rating はその日以前の全回答ログから計算し、今日と直近30日の最初の日は必ず返す。それ以外の日は、その日に回答ログがある日だけ返す。ユーザーが存在しない場合は `404` |
| `GET` | `/questions/check?id=...&answer=..&answer=..` | query: `id`, `answer` | `{"is_correct": boolean}` | `id` は問題 ID。`answer` はユーザが並べた選択肢の元 ID 配列で、繰り返し指定する。DB の複数正解パターンと比較して判定し、ログは記録しない |
| `POST` | `/answer_logs` | `{"user_id": number, "question_id": number, "is_correct": boolean}` | `{"id": number, "user_id": number, "question_id": number, "is_correct": boolean, "answered_at": string}` | ユーザ ID、問題 ID、初回判定時の正誤を回答ログとして登録する。初回かどうかはフロント側で判定し、バックエンドはリクエストが来たら記録する |
| `GET` | `/virus` | なし | `{"id": number, "difficulty": number, "prompt": string, "choices": string[], "tutorial": string}` | `virus_count` が 1 以上の問題から、各問題の `virus_count / sum(virus_count)` の確率で1問返す。レスポンス形式は `/questions/random` と同じで、`answers` は返さない。対象の問題がない場合は `404` |
| `POST` | `/virus/increase` | `{"question_id": number}` | `{"question_id": number, "virus_count": number}` | 通常出題で初回誤答した問題の `virus_count` を `+1` する |
| `POST` | `/virus/decrease` | `{"question_id": number}` | `{"question_id": number, "virus_count": number}` | virus 出題で初回正解した問題の `virus_count` を `-1` する。更新後の値が 0 未満にならないようにし、最小値は `0` とする |

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

rating を取得する例。

```bash
curl "http://127.0.0.1:8000/rating?user_id=0"
```

rating 履歴を取得する例。

```bash
curl "http://127.0.0.1:8000/rating/history?user_id=0"
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
