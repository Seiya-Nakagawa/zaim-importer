/**
 * Configuration management
 */
// プロパティサービスから値を取得
const SCRIPT_PROPERTIES = PropertiesService.getScriptProperties();

// -----------------------------------------------------------------------------
// 検索・API設定
// -----------------------------------------------------------------------------

// 検索するメールの最大件数
const SEARCH_MAX_COUNT = 100;
// 検索結果の取得開始位置（0始まり）
const SEARCH_START_INDEX = 0;

// 検索対象の日付（何日前か）
// プロパティ 'SEARCH_TARGET_DAYS_AGO' が設定されていればそれを使用
// 設定方法: Apps Scriptエディタ > プロジェクトの設定 > スクリプト プロパティ
const SEARCH_TARGET_DAYS_AGO = parseInt(SCRIPT_PROPERTIES.getProperty('SEARCH_TARGET_DAYS_AGO'), 10);

// Gemini API Endpoint
// プロパティ 'GEMINI_API_ENDPOINT' が設定されていればそれを使用
const GEMINI_API_ENDPOINT = SCRIPT_PROPERTIES.getProperty('GEMINI_API_ENDPOINT');
const ZAIM_API_BASE_URL = 'https://api.zaim.net/v2';

// -----------------------------------------------------------------------------
// メール検索設定
// -----------------------------------------------------------------------------
// キー: 内部識別子
// name: 表示名（ログ用）
// subj: Gmail検索用件名（完全一致または部分一致）
const PAYMENT_MAILTITLE_MAP = {
  'rakutenPay': {
    name: '楽天ペイ',
    subj: '楽天ペイアプリご利用内容確認メール',
  },
  'rakutenPayOnline': {
    name: '楽天ペイ',
    subj: '楽天ペイ 注文受付（自動配信メール）',
  },
  'rakutenCard': {
    name: '楽天カード',
    subj: 'カード利用のお知らせ', // 括弧を含む完全一致は検索できないため部分一致にする
  }
};

// -----------------------------------------------------------------------------
// カテゴリマッピング設定
// -----------------------------------------------------------------------------
// 店名とカテゴリの固定マッピング
// AI判定よりも優先されます。頻繁に利用する店やAIが誤判定する店を登録します。
const SHOP_CATEGORY_MAP = {
  'Jリーグ': 'エンタメ',
  'ユニクロ': '衣服・美容',
  'でいから': '食費',
  '湯花楽': 'エンタメ',
  'ＦＷＤ生命保険': '医療・保険',
  'ﾓﾊﾞｲﾙﾊﾟｽﾓﾁﾔ-ｼﾞｮｳﾄﾞ': '交通',
};

// カテゴリ名とZaimのID/ジャンルIDのマッピング
// ※ IDは checkCategories() の結果に基づき設定
// ※ ジャンルIDはデフォルト(categoryId * 100 + 01)と仮定しています
const CATEGORY_MAP = {
  '食費':       { id: 101, genreId: 10101 },
  '日用雑貨':   { id: 102, genreId: 10201 },
  '交通':       { id: 103, genreId: 10301 },
  '通信':       { id: 104, genreId: 10401 },
  '水道・光熱': { id: 105, genreId: 10501 },
  '住まい':     { id: 106, genreId: 10601 },
  '交際費':     { id: 107, genreId: 10701 },
  'エンタメ':   { id: 108, genreId: 10801 },
  '教育・教養': { id: 109, genreId: 10901 },
  '医療・保険': { id: 110, genreId: 11001 },
  '美容・衣服': { id: 111, genreId: 11101 },
  'クルマ':     { id: 112, genreId: 11201 },
  '税金':       { id: 113, genreId: 11301 },
  '大型出費':   { id: 114, genreId: 11401 },
  'その他':     { id: 199, genreId: 19901 }
};
