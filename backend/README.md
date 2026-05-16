## Backend

Linux Virus の macOS 常駐バックエンド。

## API

| Method | Path | 入力 | 出力 | 説明 |
| --- | --- | --- | --- | --- |
| `GET` | `/` | なし | `{"message": "Linux Virus Backend is running"}` | APIの起動確認 |
| `GET` | `/health` | なし | `{"status": "ok"}` | ヘルスチェック |
| `GET` | `/questions/sample` | なし | `{"prompt": string, "choices": string[], "answers": number[][], "tutorial": string}` | サンプル問題をランダムに1問返す |


## 実行

```bash
uv sync --all-packages
uv run --directory backend uvicorn app.main:app --reload
```

起動後、以下で確認可能。

```bash
curl http://127.0.0.1:8000/health
```


## データベース

SQLite を使用。DB ファイルは `backend/app.db` に自動生成される。

### 初期化

**サーバー起動時に自動でテーブルが作成される**ため、手動マイグレーションは不要。

環境構築時は以下のシードコマンドで初期問題データ（20 問）を投入する。

```bash
uv run --directory backend python seed.py
```

questions テーブルにすでにデータがある場合はスキップされる。
データをリセットして再投入したい場合は `--force` を付ける。

```bash
uv run --directory backend python seed.py --force
```

DB ファイルを完全に作り直したい場合はファイルを削除してから再実行する。

```bash
rm backend/app.db
uv run --directory backend python seed.py
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
