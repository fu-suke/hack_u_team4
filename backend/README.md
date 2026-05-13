## API

現在は動作確認用の最小APIのみ用意。

- `GET /` - APIの起動確認
- `GET /health` - ヘルスチェック
- `GET /questions/sample` - サンプル問題

## Setup

`backend` ディレクトリで仮想環境を作成し、依存関係をインストール。

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Start

```bash
uvicorn app.main:app --reload
```

起動後、以下で確認可能。

```bash
curl http://127.0.0.1:8000/health
```
