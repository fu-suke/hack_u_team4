# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 概要

**Linux Virus** — macOS に常駐し、設定したタイマーやコマンド入力をトリガーに Linux コマンドのクイズを表示する学習支援アプリ。

- **frontend**: PyObjC ベースの macOS 常駐アプリ。`WKWebView` に HTML/CSS/JS を埋め込んで UI を描画
- **backend**: FastAPI + SQLAlchemy (SQLite) による REST API

## コマンド

### セットアップ・起動

```bash
# 依存関係インストール
uv sync --all-packages

# DB 初期化（初回 or リセット時）
uv run --directory backend python seed.py --force

# 両プロセス同時起動（Procfile 経由）
uv run honcho start
```

### 個別起動

```bash
# バックエンドのみ
uv run --directory backend uvicorn app.main:app --reload

# フロントエンドのみ
uv run --package linux-virus-frontend linux-virus-frontend
```

### Lint / 型チェック（コード変更後は必ず実行）

```bash
uv run ruff check
uv run ty check
```

## アーキテクチャ

### フロントエンド (`frontend/linux_virus_frontend/`)

| ファイル | 役割 |
|----------|------|
| `app.py` | エントリポイント。アクセシビリティ権限要求 → `_ResidentAppController` 起動 |
| `controller.py` | `NSObject` サブクラス。NSTimer で `pollEvents_` / `tickTimer_` を駆動し、状態遷移とウィンドウ操作を担う |
| `state.py` | `_ResidentState` データクラス。タイマー残り秒数・スリープ・キーバッファ・view 状態を管理 |
| `web_bridge.py` | `WKWebView` からのメッセージを受け取り `controller.handle_script_message` へ委譲 |
| `keyboard.py` | NSEvent からキーラベルを生成するインタープリタ |
| `mac_window.py` | `NSWindow` / `WKWebView` の生成ヘルパー |
| `config.py` | ウィンドウサイズ・デフォルト値などの定数 |

**UI (web/)**: `WKWebView` に読み込まれる静的 HTML/CSS/JS。Python → JS は `window.residentSetState(payload)` で状態同期。JS → Python は `window.webkit.messageHandlers.bridge.postMessage(action)` で送信。

### バックエンド (`backend/app/`)

| ファイル/ディレクトリ | 役割 |
|-----------------------|------|
| `main.py` | FastAPI アプリ定義・ルーター登録・CORS 設定 |
| `models.py` | SQLAlchemy モデル: `User`, `Question`, `AnswerLog` |
| `schemas.py` | Pydantic スキーマ |
| `database.py` | SQLite 接続・セッション管理 |
| `routers/questions.py` | `GET /questions` (ランダム出題), `GET /questions/sample`, `GET /questions/check` |
| `routers/answer_logs.py` | `POST /answer_logs` (回答記録) |
| `routers/users.py` | ユーザー管理 |

フロントエンド JS は `http://127.0.0.1:8000` に直接 fetch する。

### 状態遷移

`_ResidentState.view` は `minimized` → `expanded` / `settings` の3値を取る。`expanded` 時に WKWebView がバックエンドへクイズを要求し、回答後に `minimize_window` で戻る。

## コーディング規約

- **ignoreはpyproject.tomlに理由付きで記載**。コード中に直接 `# noqa` / `# ty: ignore` を書かない
- **公開関数には Google 式 docstring（日本語）**。`_` プレフィックス付きのプライベート関数には不要
- **`@function_tool` 付き関数の docstring は英語**
- `hasattr` は基本使用禁止
- コミットメッセージは `feat:` / `fix:` / `docs:` / `style:` / `refactor:` / `test:` / `chore:` / `perf:` / `ci:` プレフィックス付き英語
