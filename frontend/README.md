## Frontend

Linux Virus の macOS 常駐フロントエンド。

- 常時前面の小さいウィンドウを表示
- `WKWebView` で HTML/CSS/JS の UI を描画
- タイマーや入力コマンドをトリガーに拡大表示
- 将来クイズを表示する領域を用意

## 実行

```bash
uv sync --all-packages
uv run --package linux-virus-frontend linux-virus-frontend
```

## 現時点で確認できること

- Python だけで「画面内に残る小さい UI」を作れること。
- Python の常駐処理から `WKWebView` の JS UI を制御できること。
- macOS の許可を得れば、アプリが前面でなくてもキー入力を監視できること。
- タイマーや入力コマンドをトリガーにして、常駐 UI を拡大表示できること。

本番化ではメニューバー常駐、署名済み `.app` 化、権限導線、入力内容の扱いに関する明示的な同意 UI が必要です。
