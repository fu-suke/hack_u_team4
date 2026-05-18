# Linux Virus データフロー

## 概要
本ドキュメントは、Linux Virus アプリケーションにおけるユーザの一連の解答フローと、コンポーネント間のやり取りをまとめたものです。

---

## 1. システム構成

| コンポーネント | 役割 |
|---|---|
| Resident App (Python) | macOS 常駐アプリ。キー検知・ウィンドウ管理・WKWebView の起動を担当 |
| Web UI (HTML/CSS/JS) | WKWebView 内で動作する画面。問題表示・D&D・解答提出を担当 |
| Backend (FastAPI) | API サーバ。DB アクセス・問題取得・正誤判定・ログ記録を担当 |
| DB (SQLite) | 問題・ユーザ・解答ログを永続化 |

---

## 2. シーケンス図

ユーザがキー検知をトリガにして問題を解き、画面制限が解除されるまでの一連の流れを示す。

```mermaid
sequenceDiagram
    autonumber
    actor User as ユーザ
    participant Resident as Resident App<br/>(Python)
    participant WebUI as Web UI<br/>(JS in WKWebView)
    participant Backend as Backend<br/>(FastAPI)
    participant DB as DB<br/>(SQLite)

    Note over User,Resident: 最小化状態(タイマー表示のみ)

    User->>Resident: 検知対象キー入力<br/>(例: Cmd+V)<br/>or タイマーが0秒
    Resident->>Resident: キー検知 → ウィンドウ拡大<br/>(オーバーレイで操作制限)
    Resident->>WebUI: 画面を expanded 状態に遷移

    Note over WebUI,Backend: 問題取得フェーズ

    WebUI->>Backend: GET /questions/random
    Backend->>DB: SELECT 問題をランダムに 1 件
    DB-->>Backend: 問題データ
    Backend-->>WebUI: { id, difficulty, prompt, choices, tutorial }
    WebUI->>WebUI: choices をフロントでシャッフル
    WebUI->>User: 問題文と選択肢を表示

    Note over User,WebUI: 解答フェーズ

    User->>WebUI: D&D で選択肢を並べ替え
    User->>WebUI: 「解答を提出」ボタン押下
    WebUI->>WebUI: ユーザの並びを元 ID 列に変換<br/>(例: [1, 3, 2])

    Note over WebUI,Backend: 正誤判定フェーズ

    WebUI->>Backend: GET /questions/check<br/>?id={question_id}&answer={id1}&answer={id2}...
    Backend->>DB: SELECT 問題の answers
    DB-->>Backend: answers (例: [[1, 3, 2], [1, 2, 3]])
    Backend->>Backend: ユーザの answer と比較
    Backend-->>WebUI: { is_correct }
    WebUI->>User: 正誤結果と解説を表示

    Note over WebUI,Backend: ログ記録フェーズ(初回のみ)

    WebUI->>WebUI: 「ログ送信済みフラグ」を確認<br/>(フロント側で管理)
    alt 初回の判定(フラグが false)
        WebUI->>Backend: POST /answer_logs<br/>{ user_id, question_id, is_correct }
        Backend->>DB: INSERT INTO answer_logs
        DB-->>Backend: 記録完了
        Backend-->>WebUI: 201 Created
        WebUI->>WebUI: ログ送信済みフラグを true に
    else 2 回目以降(フラグが true)
        WebUI->>WebUI: ログ送信をスキップ
    end

    Note over User,Resident: 制限解除フェーズ

    alt 正解の場合
        WebUI->>Resident: postMessage("minimize")
        Resident->>Resident: オーバーレイを非表示<br/>ウィンドウを最小化
        Resident->>User: 操作制限解除
    else 不正解の場合
        WebUI->>User: 「誤り」と表示してリトライ<br/>(制限は解除されない)
        Note over User,WebUI: 解答フェーズに戻り、<br/>ユーザは正解するまで抜け出せない
    end
```

---

## 3. データの流れの要点

### 3.1 選択肢のシャッフルとID管理
- DB には `choices` が元順序で格納されている(元 ID は 1, 2, 3, ...)
- バックエンドは元順序のままフロントに返す
- フロントはシャッフルして表示するが、元 ID を保持しておく
- 解答提出時は元 ID 列をバックエンドに送る
- バックエンドは DB の `answers`(元 ID で記録)と直接比較できる

### 3.2 ログ記録の「初回のみ」ルール
- フロント側で「ログ送信済みフラグ」を問題ごとに管理
- 同じ問題でリトライしても 2 回目以降は POST しない
- 問題が新しく表示された時点でフラグはリセットされる

### 3.3 制限解除のトリガ
- 正解時: フロントから `minimize` メッセージを Python 側に送り、オーバーレイを非表示にして操作制限を解除
- 不正解時: 「誤り」と解説を表示するのみ。操作制限は解除されず、ユーザは正解するまで解答フェーズを繰り返す
