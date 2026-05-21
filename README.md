# Linux Virus

Linux Virus は、macOS に常駐して特定のタイミングで Linux コマンドのクイズを表示する学習支援アプリです。

作業中にタイマーや指定したキー操作をきっかけに問題を出し、表示されたトークンを並び替えて Linux コマンドを完成させます。

正解時には解説を確認でき、ログインして使うと回答履歴に応じた問題や復習問題が出題されます。

## 使い方

1. `Settings` を開き、出題までの秒数と出題のきっかけにしたいキー操作を設定します。
2. `Commands` には `Command+V` や `/focus` など、作業中に検出したい操作を登録します。
3. 複数の操作で出題したい場合は `+` から入力欄を追加します。最大10個まで登録できます。
4. `Done` を押すと設定が保存され、カウントダウンが始まります。
5. タイマーが終わるか、登録した操作を入力すると Linux コマンドの問題が出題されます。
6. 表示されたトークンを正しい順番に選び、`答え合わせ` を押します。
7. 正解すると解説を確認できます。不正解の場合はトークンを選び直して再挑戦できます。
8. ショートカットの書き方が分からない場合は、設定画面の `?` から表記例を確認できます。

## macOS 権限

グローバルホットキーとバックグラウンドのキーボード入力監視には macOS の権限が必要です。

1. 初回実行時に許可ダイアログが出たら許可します。
2. 出ない場合は `システム設定 > プライバシーとセキュリティ` で以下を許可します。
   - アクセシビリティ
   - 入力監視
3. ターミナルから起動している場合、許可対象は Linux Virus ではなく実行元です。
   - ターミナル
   - iTerm
   - VS Code
   - Cursor
4. 許可後に起動中のターミナルアプリを完全に終了し、再起動してから Linux Virus を起動します。

## 終了

ターミナルで `Ctrl+C` を押して終了できます。

ターミナルにフォーカスが戻せない場合は、別のターミナルから以下でプロセスを終了できます。

```bash
pkill -f "resident_poc"
# または honcho ごと終了
pkill -f honcho
```

ポート 8000 が使用中（`Address already in use`）で起動できない場合は、残っているプロセスを終了します。

```bash
lsof -ti :8000 | xargs kill -9
```

## 実行

通常利用では、以下のコマンドで起動できます。

### uv のインストール

`uv` が未インストールの場合は、先にインストールします。

```bash
brew install uv
```

### アプリ起動

リポジトリルートで以下を実行します。

```bash
API_BASE_URL=https://linux-virus-backend.onrender.com uv run --package linux-virus-frontend linux-virus-frontend
```

## 環境構成と起動パターン

バックエンドと DB は、ローカルでもリモート（Render）でも動作します。接続先は環境変数で切り替えます。

- `DATABASE_URL`: バックエンドが接続する DB。未指定ならローカルの SQLite（`backend/app.db`）を使用
- `API_BASE_URL`: フロントが接続するバックエンド。未指定なら `.env.public` の値に従う

切り替えは、起動時に環境変数を指定することで行います（環境変数は `.env.public` の値より優先されます）。

### パターン1: バックエンドもDBもローカル

バックエンド・DB ともにローカル。オフライン開発や、共有 DB を汚したくない場合に使用。

初回またはデータを初期状態に戻したい場合は、DB の初期データを投入します。

```bash
uv sync --all-packages
uv run --directory backend python seed.py --force
```

アプリを起動する場合は、リポジトリルートで以下を実行します。

```bash
uv run honcho start
```

### パターン2: バックエンドはローカル、DB はリモート

バックエンドのコードを触りながら、共有の Render DB の状態を見たい場合に使用。

```bash
DATABASE_URL="<Render の External Database URL>" uv run --directory backend uvicorn app.main:app --reload
```

### パターン3: すべてリモート
 
バックエンドは Render 上で常時稼働中。フロント開発や本番動作確認に使用。フロント起動時に Render のバックエンドを向ける。
 
`.env.public` のデフォルトはローカルバックエンド（`http://127.0.0.1:8000`）になっているため、Render に接続したい場合は起動時に環境変数で上書きする。
 
```bash
API_BASE_URL=https://linux-virus-backend.onrender.com uv run --package linux-virus-frontend linux-virus-frontend
```
 
`.env.public` は編集せず、接続先の切り替えは常に起動時の環境変数で行う（環境変数は `.env.public` の値より優先される）。
 
**Render の External Database URL は 秘匿情報** です。<u>公開の場（パブリックな Discord チャンネルなど）には貼らないでください。</u>

## Render（バックエンド / DB のホスティング）

バックエンドと DB は Render にホストされています。

- バックエンド URL: `https://linux-virus-backend.onrender.com`
- ヘルスチェック: `https://linux-virus-backend.onrender.com/health`
- インフラ構成：`render.yaml`

### 自動デプロイ

`master` ブランチへの push で、Render に自動デプロイされます。手動操作は不要です。

### Render の DB にシードを投入する

ローカルから External Database URL を指定してシードを実行します。

```bash
DATABASE_URL="<Render の External Database URL>" uv run --directory backend python seed.py
```

データを初期状態に戻して再投入したい場合は `--force` を付けます。

```bash
DATABASE_URL="<Render の External Database URL>" uv run --directory backend python seed.py --force
```

> Render の無料プランはアクセスがない間スリープします。スリープからの復帰には最初のリクエストで数秒〜十数秒かかります。デモ前には一度アクセスして起こしておくと安心です。
