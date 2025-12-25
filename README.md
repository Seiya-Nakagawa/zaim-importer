# Zaim Email Importer

Gmailに着信する決済サービスの利用通知メール（楽天Pay、楽天カードなど）を自動的に解析し、家計簿アプリ「Zaim」に支出として自動登録する Google Apps Script (GAS) ツールです。
店舗名から適切なカテゴリを自動判定するために、Google Gemini API を活用しています。

## ✨ 特徴

- **自動取込**: 指定した期間のメールを検索し、Zaimに自動登録します。
- **対応サービス**:
  - 楽天ペイ（アプリ決済）
  - 楽天ペイ（オンライン決済）
  - 楽天カード（速報版ではなく、利用明細が記載されたメール）
- **AIカテゴリ判定**: 店舗名を Gemini API (Generative AI) に送信し、Zaimのカテゴリ（食費、日用品など）を自動で推論・設定します。

## 🛠 セットアップ

### 1. Google Apps Script プロジェクトの作成

1. Google Drive上で新規 GAS プロジェクトを作成します。
2. `.clasp.json` の `scriptId` を作成したプロジェクトのものに書き換えます。
3. 以下のコマンドを使用して、ローカルのファイルを GAS プロジェクトに反映させます。

#### ログイン

```powershell
npx @google/clasp login
```

#### プッシュ (アップロード)

```powershell
npx @google/clasp push
```

### 2. ライブラリの導入

GASエディタの「ライブラリ」から以下のライブラリを追加してください。

- **OAuth1**
  - スクリプトID: `1CXDCY5sqT9ph64fFwSzVtXnbjpSfWdRymafDrtIZ7Z_hwysTY7IIhi7s`
  - バージョン: 最新

### 3. スクリプトプロパティの設定

GASエディタの「プロジェクトの設定」>「スクリプト プロパティ」に以下の値を設定してください。

| プロパティ名 | 説明 |
| --- | --- |
| `ZAIM_CONSUMER_KEY` | Zaim Developersで取得した Consumer Key |
| `ZAIM_CONSUMER_SECRET` | Zaim Developersで取得した Consumer Secret |
| `GEMINI_API_KEY` | Google AI Studioで取得した Gemini API Key |
| `GEMINI_API_ENDPOINT` | Gemini APIのエンドポイントURL（例: `https://...:generateContent?key=`） |
| `SEARCH_TARGET_DAYS_AGO` | 何日前までのメールを検索対象とするか（例: `3`） |

### 4. Zaim 認証 (OAuth)

1. `src/OAuth.js` 内の `printAuthUrl()` 関数を実行します。
2. ログに表示された URL をブラウザで開きます。
3. Zaim の認証画面で「許可」をクリックします。
4. 認証が成功すると、アクセストークンがスクリプトプロパティに自動保存されます。

## 🚀 使い方

### 手動実行

`src/Code.js` の `main()` 関数を実行してください。

### 定期実行（トリガー設定）

GASのトリガー設定画面から、`main` 関数を「時間主導型」トリガー（例: 1日1回など）で設定してください。

## 📂 ファイル構成

- `src/Code.js`: メインロジック。メール検索から登録までのフローを制御。
- `src/Config.js`: 設定ファイル。検索条件やカテゴリマッピング定義。
- `src/Parsers.js`: メール解析ロジック。サービスごとの正規表現などを定義。
- `src/CategoryHandler.js`: カテゴリ判定ロジック。固定マップとGemini APIを併用。
- `src/ZaimClient.js`: Zaim API との通信を行うクライアントクラス。
- `src/OAuth.js`: OAuth 1.0a 認証処理。

## ⚠️ 注意事項

- **API制限**: Zaim API や Gemini API には利用制限があります。大量のデータを一度に処理する場合はご注意ください。
- **セキュリティ**: APIキーやトークンは必ずスクリプトプロパティで管理し、コード内に直接記述しないでください。
