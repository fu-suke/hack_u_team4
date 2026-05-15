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
