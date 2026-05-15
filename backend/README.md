## API

現在は動作確認用の最小APIのみ用意。

- `GET /` - APIの起動確認
- `GET /health` - ヘルスチェック
- `GET /questions/sample` - サンプル問題

## 実行

```bash
uv sync --all-packages
uv run --directory backend uvicorn app.main:app --reload
```

起動後、以下で確認可能。

```bash
curl http://127.0.0.1:8000/health
```
