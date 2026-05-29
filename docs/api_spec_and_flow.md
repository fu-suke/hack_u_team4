# Linux Virus データフロー

## 概要
本ドキュメントは、Linux Virus アプリケーションにおけるユーザの一連の解答フローと、コンポーネント間のやり取りをまとめたものです。

---

## 1. システム構成

| コンポーネント | 役割 |
|---|---|
| Resident App (Python) | macOS 常駐アプリ。キー検知・ウィンドウ管理・WKWebView の起動・ウイルスタイマーを担当 |
| Web UI (HTML/CSS/JS) | WKWebView 内で動作する画面。問題表示・ターミナル入力・D&D・解答提出を担当 |
| Backend (FastAPI) | API サーバ。問題取得・正誤判定・ログ記録・レーティング計算・ウイルスカウント管理を担当 |
| DB (SQLite) | 問題・ユーザ・解答ログ・ウイルスカウントを永続化 |

---

## 2. 状態遷移

`_ResidentState.view` は `minimized` / `expanded` / `settings` / `user` の 4 値を取る。
通常のウィンドウとは独立して、ウイルスウィンドウが別ウィンドウとして存在することがある。

```mermaid
stateDiagram-v2
    [*] --> minimized: 起動

    minimized --> expanded: タイマー満了 / 登録コマンド入力 / ホットキー
    minimized --> settings: 設定ボタン
    minimized --> user: ユーザボタン

    expanded --> minimized: 正解後「閉じる」
    settings --> minimized: 「反映」
    user --> minimized: ログイン/ログアウト完了

    state "ウイルスウィンドウ (独立)" as virus {
        [*] --> virus_open: ウイルスタイマー満了
        virus_open --> [*]: 正解後「閉じる」 / ワクチン使用
    }
```

---

## 3. 通常出題フロー

コマンド入力またはタイマー満了を契機に問題が出題され、正解後に制限が解除されるまでの流れ。

```mermaid
sequenceDiagram
    autonumber
    actor User as ユーザ
    participant Resident as Resident App<br/>(Python)
    participant WebUI as Web UI<br/>(JS in WKWebView)
    participant Backend as Backend<br/>(FastAPI)
    participant DB as DB<br/>(SQLite)

    Note over User,Resident: 最小化状態(タイマー表示のみ)

    alt タイマーが満了
        Resident->>Resident: タイマー切れを検知
    else 登録コマンドをタイプ入力
        User->>Resident: キー入力 → コマンド文字列を検知
    else トグルホットキー
        User->>Resident: ホットキー入力
    end
    Resident->>Resident: ウィンドウ拡大 (オーバーレイで操作制限)
    Resident->>WebUI: state="expanded" を同期

    Note over WebUI,Backend: 問題取得フェーズ

    WebUI->>WebUI: expanded 遷移を検知 → 問題取得開始
    alt ログイン中 かつ パーソナライズ有効
        WebUI->>Backend: パーソナライズ問題を要求
        Backend->>DB: 正答率・難易度を集計して重み付き選択
    else
        WebUI->>Backend: ランダム問題を要求
        Backend->>DB: 問題をランダムに 1 件 SELECT
    end
    DB-->>Backend: 問題データ
    Backend-->>WebUI: 問題データ (choices 含む)
    WebUI->>WebUI: choices をシャッフルして表示

    opt ユーザがログイン中
        WebUI->>Backend: 解答前レーティングを取得
        WebUI->>Backend: 現在のストリーク数を取得
        Backend-->>WebUI: レーティング・ストリーク
    end
    WebUI->>User: 問題文・トークン・ターミナル入力欄を表示

    Note over User,WebUI: 解答フェーズ

    alt ターミナル入力
        User->>WebUI: コマンドをターミナルに入力 (Tab 補完可)
        User->>WebUI: Enter キー送信
    else トークン D&D
        User->>WebUI: トークンを並べ替え
        User->>WebUI: 「解答を提出」ボタン押下
    end

    Note over WebUI,Backend: 正誤判定フェーズ

    WebUI->>Backend: 解答を送信して正誤判定を要求
    Backend->>DB: 正解データを取得して比較
    DB-->>Backend: 正解データ
    Backend-->>WebUI: 正誤結果

    Note over WebUI,Backend: ログ記録・後処理フェーズ (初回のみ)

    WebUI->>WebUI: 「ログ送信済みフラグ」を確認
    alt 初回の判定 (フラグが false)
        opt ユーザがログイン中
            WebUI->>Backend: 解答ログを記録
            Backend->>DB: AnswerLog を INSERT
            WebUI->>Backend: 新レーティングを取得
            Backend-->>WebUI: 新レーティング
            alt 正解
                WebUI->>Backend: 新ストリーク数を取得
                Backend-->>WebUI: ストリーク数
            end
        end
        alt 通常モード かつ 不正解
            WebUI->>Backend: ウイルスカウントを +1
            Backend->>DB: question.virus_count を増加
        end
        WebUI->>WebUI: フラグを true に
    else 2 回目以降 (フラグが true)
        WebUI->>WebUI: ログ送信・ウイルスカウント更新をスキップ
    end

    Note over User,Resident: 制限解除フェーズ

    alt 正解の場合
        WebUI->>User: 正解・解説・レーティング変化・ストリーク数を表示
        User->>WebUI: 「閉じる」ボタン押下
        WebUI->>Resident: minimize メッセージを送信
        Resident->>Resident: オーバーレイを非表示・ウィンドウ最小化
        Resident->>User: 操作制限解除・タイマー再起動
    else 不正解の場合
        WebUI->>User: 「もう一回やってみよう」と表示
        Note over User,WebUI: 解答フェーズに戻る (正解まで繰り返し)
    end
```

---

## 4. ウイルス出題フロー

Resident App が一定間隔でウイルス問題の有無を確認し、溜まっていれば別ウィンドウで出題する。
通常出題ウィンドウが表示中でも並行して起動する。

```mermaid
sequenceDiagram
    autonumber
    actor User as ユーザ
    participant Resident as Resident App<br/>(Python)
    participant VirusUI as Virus Web UI<br/>(WKWebView 別ウィンドウ)
    participant Backend as Backend<br/>(FastAPI)
    participant DB as DB<br/>(SQLite)

    Note over Resident: ウイルスタイマーが満了 (デフォルト5分間隔)
    Resident->>Resident: ウイルスウィンドウを新規生成
    Resident->>VirusUI: state="expanded", quizMode="virus" を同期
    Resident->>Resident: オーバーレイを表示 (操作制限)

    Note over VirusUI,Backend: 問題取得フェーズ

    VirusUI->>Backend: ウイルス問題を要求
    Backend->>DB: virus_count > 0 の問題を重み付き選択
    DB-->>Backend: 問題データ
    Backend-->>VirusUI: 問題データ
    VirusUI->>User: 問題文・トークン・ターミナル入力欄を表示
    Note over VirusUI: ペンギンアイコンがウイルス版に変わる

    Note over User,VirusUI: 解答フェーズ (通常フローと同様)

    User->>VirusUI: コマンドを入力して送信

    Note over VirusUI,Backend: 正誤判定・後処理フェーズ (初回のみ)

    VirusUI->>Backend: 解答を送信して正誤判定を要求
    Backend-->>VirusUI: 正誤結果

    alt 初回の判定
        opt ユーザがログイン中
            VirusUI->>Backend: 解答ログを記録
            VirusUI->>Backend: 新レーティングを取得
            Backend-->>VirusUI: 新レーティング
        end
        alt ウイルスモード かつ 正解
            VirusUI->>Backend: ウイルスカウントを -1
            Backend->>DB: virus_count を減算 (0 になれば行を削除)
        end
    end

    Note over User,Resident: 解除フェーズ

    alt 正解の場合
        VirusUI->>User: 正解・解説・レーティング変化を表示
        User->>VirusUI: 「閉じる」ボタン押下
        VirusUI->>Resident: closeVirus メッセージを送信
        Resident->>Resident: ウイルスウィンドウを閉じる・タイマーをリスタート
        Resident->>User: 操作制限解除
    else ワクチンを使用 (最大3回/クールダウン)
        User->>VirusUI: ワクチンボタン押下
        VirusUI->>Resident: useVaccine メッセージを送信
        Resident->>Resident: ウイルスウィンドウを閉じる・タイマーをリスタート
        Resident->>User: 操作制限解除 (スキップ)
    else 不正解の場合
        VirusUI->>User: 「もう一回やってみよう」と表示
        Note over User,VirusUI: 解答フェーズに戻る (正解 or ワクチンまで繰り返し)
    end
```

---

## 5. データの流れの要点

### 5.1 選択肢のシャッフルと ID 管理
- DB には `choices` が元順序で格納されている (元 ID は 1, 2, 3, ...)
- バックエンドは元順序のままフロントに返す
- フロントはシャッフルして表示するが、元 ID を保持しておく
- 解答提出時は元 ID 列をバックエンドに送る
- バックエンドは DB の `answers` (元 ID で記録) と直接比較できる

### 5.2 解答入力の二系統
- **ターミナル入力 (主)**: `#terminalInput` にコマンドを直接タイプ。Tab キーで未使用トークンを補完できる
- **トークン D&D (副)**: トークンボタンをドラッグ&ドロップまたはクリックして並べ替える
- 送信時はターミナル入力値を優先し、空の場合は D&D の selected 列を使用する

### 5.3 ログ記録の「初回のみ」ルール
- フロント側で `answerLogged` フラグを問題ごとに管理
- 同じ問題でリトライしても 2 回目以降はログ送信・ウイルスカウント更新をしない
- 新しい問題が読み込まれた時点でフラグはリセットされる

### 5.4 ウイルスカウントの増減ロジック

| 出題モード | 結果 | virus_count |
|---|---|---|
| 通常 | 不正解 (初回のみ) | +1 |
| ウイルス | 正解 (初回のみ) | -1 |
| 上記以外 | — | 変化なし |

### 5.5 レーティングとストリーク
- 問題読み込み時に解答前レーティングを取得し、正誤判定後の新レーティングとの差分 (±) を表示する
- ストリーク (連続正解数) は問題読み込み時と正解後にそれぞれ取得し、2 以上の場合にバッジを表示する
- レーティング・ストリークの取得はログイン中のみ行う

### 5.6 パーソナライズ出題
- ログイン中かつ設定でパーソナライズが有効な場合、過去 7 日間の解答履歴から難易度を推定して問題を選ぶ
- パーソナライズ取得に失敗した場合はランダム取得にフォールバックする

### 5.7 ワクチン
- フロントの localStorage に残量 (最大 3 本) を管理する
- ウイルス出題時のみ使用可能で、ウイルスウィンドウを閉じて問題をスキップできる
- ワクチン使用は解答ログに記録されない
