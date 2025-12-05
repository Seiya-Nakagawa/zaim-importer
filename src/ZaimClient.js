/**
 * Zaim API Client
 */

var ZaimClient = function() {
  this.service = getService();
  this.baseUrl = ZAIM_API_BASE_URL;
  this.categoriesCache = null;
};

/**
 * 支払いデータを登録する
 * Zaim API (POST /home/money/payment) を呼び出して家計簿データを登録します
 *
 * @param {Object} paymentData - 支払いデータ
 *   - date: 日付 (YYYY-MM-DD形式)
 *   - amount: 金額 (数値)
 *   - shop: 店舗名 (文字列)
 *   - categoryId: カテゴリID (数値)
 *   - genreId: ジャンルID (数値)
 * @return {Object} APIレスポンス
 */
ZaimClient.prototype.registerPayment = function(paymentData) {
  // 認証チェック
  if (!this.service.hasAccess()) {
    throw new Error('Zaimの認証がされていません。printAuthUrl()を実行して認証してください。');
  }

  // 必須パラメータのバリデーション
  if (!paymentData.date || !paymentData.amount || !paymentData.shop) {
    throw new Error('必須パラメータが不足しています: date, amount, shop');
  }

  var url = this.baseUrl + '/home/money/payment';

  // コメントの作成
  var comment = ZAIM_COMMENT_PREFIX;
  if (paymentData.paymentSource) {
    comment += ' (' + paymentData.paymentSource + ')';
  }

  // 送信データの構築
  // mapping=1 を指定することで、category_id/genre_id を優先して登録できる
  var payload = {
    mapping: 1, // 1: 入力されたカテゴリID等を優先
    category_id: paymentData.categoryId || ZAIM_DEFAULT_CATEGORY_ID, // デフォルト: 食費
    genre_id: paymentData.genreId || ZAIM_DEFAULT_GENRE_ID,     // デフォルト: 食料品
    amount: paymentData.amount,
    date: paymentData.date,
    place: paymentData.shop,
    comment: comment
  };

  var options = {
    method: 'post',
    payload: payload,
    muteHttpExceptions: true // エラーレスポンスも取得できるようにする
  };

  try {
    console.log('Zaim API呼び出し: ' + url);
    console.log('送信データ: ' + JSON.stringify(payload));

    var response = this.service.fetch(url, options);
    var responseCode = response.getResponseCode();
    var responseText = response.getContentText();

    console.log('HTTPステータス: ' + responseCode);
    console.log('レスポンス: ' + responseText);

    var result = JSON.parse(responseText);

    if (responseCode === 200) {
      console.log('✅ Zaim登録成功: ' + JSON.stringify(result));
      return result;
    } else {
      console.error('❌ Zaim登録失敗 (HTTP ' + responseCode + '): ' + JSON.stringify(result));
      throw new Error('Zaim API returned error: HTTP ' + responseCode + ' - ' + JSON.stringify(result));
    }
  } catch (e) {
    console.error('❌ Zaim登録エラー: ' + e.message);
    throw e;
  }
};

/**
 * 家計簿データを取得する
 * @param {Object} params - 検索パラメータ (start_date, end_date, limitなど)
 * @return {Object} APIレスポンス { money: [...] }
 */
ZaimClient.prototype.getMoney = function(params) {
  // 認証チェック
  if (!this.service.hasAccess()) {
    throw new Error('Zaimの認証がされていません。');
  }

  var url = this.baseUrl + '/home/money';

  // クエリパラメータの構築
  if (params) {
    var queryString = Object.keys(params).map(function(key) {
      return key + '=' + encodeURIComponent(params[key]);
    }).join('&');
    url += '?' + queryString;
  }

  var options = {
    method: 'get',
    muteHttpExceptions: true
  };

  try {
    console.log('Zaimデータ取得: ' + url);
    var response = this.service.fetch(url, options);
    var responseCode = response.getResponseCode();
    var result = JSON.parse(response.getContentText());

    if (responseCode === 200) {
      return result;
    } else {
      throw new Error('Failed to get money: ' + responseCode);
    }
  } catch (e) {
    console.error('取得エラー: ' + e.message);
    throw e;
  }
};

/**
 * 家計簿データを削除する
 * @param {number} moneyId - 削除するデータのID
 * @return {boolean} 成功したかどうか
 */
ZaimClient.prototype.deletePayment = function(moneyId) {
  // 認証チェック
  if (!this.service.hasAccess()) {
    throw new Error('Zaimの認証がされていません。');
  }

  var url = this.baseUrl + '/home/money/payment/' + moneyId;

  var options = {
    method: 'delete',
    muteHttpExceptions: true
  };

  try {
    console.log('Zaimデータ削除: ' + moneyId);
    var response = this.service.fetch(url, options);
    var responseCode = response.getResponseCode();
    var result = JSON.parse(response.getContentText());

    if (responseCode === 200) {
      console.log('✅ 削除成功: ' + moneyId);
      return true;
    } else {
      console.error('❌ 削除失敗: ' + JSON.stringify(result));
      return false;
    }
  } catch (e) {
    console.error('削除エラー: ' + e.message);
    return false;
  }
};

/**
 * カテゴリ一覧を取得する
 * Zaimに登録されているカテゴリとジャンルの一覧を取得します
 * ※ 主に設定ファイル(Config.js)作成時のID確認用です
 * @return {Object} カテゴリ一覧
 */
ZaimClient.prototype.getCategories = function() {
  // キャッシュがあればそれを返す
  if (this.categoriesCache) {
    return this.categoriesCache;
  }

  // 認証チェック
  if (!this.service.hasAccess()) {
    throw new Error('Zaimの認証がされていません。printAuthUrl()を実行して認証してください。');
  }

  var url = this.baseUrl + '/home/category';

  var options = {
    method: 'get',
    muteHttpExceptions: true
  };

  try {
    console.log('カテゴリ取得: ' + url);

    var response = this.service.fetch(url, options);
    var responseCode = response.getResponseCode();
    var responseText = response.getContentText();

    console.log('HTTPステータス: ' + responseCode);

    var result = JSON.parse(responseText);

    if (responseCode === 200) {
      console.log('✅ カテゴリ取得成功');
      // console.log(JSON.stringify(result, null, 2)); // ログが多すぎるのでコメントアウト

      // キャッシュに保存
      this.categoriesCache = result;
      return result;
    } else {
      console.error('❌ カテゴリ取得失敗 (HTTP ' + responseCode + '): ' + JSON.stringify(result));
      throw new Error('Failed to get categories: HTTP ' + responseCode);
    }
  } catch (e) {
    console.error('❌ カテゴリ取得エラー: ' + e.message);
    throw e;
  }
};

/**
 * ジャンル一覧を取得する
 * @return {Object} ジャンル一覧 { genres: [...] }
 */
ZaimClient.prototype.getGenres = function() {
  // 認証チェック
  if (!this.service.hasAccess()) {
    throw new Error('Zaimの認証がされていません。');
  }

  var url = this.baseUrl + '/home/genre';

  var options = {
    method: 'get',
    muteHttpExceptions: true
  };

  try {
    console.log('ジャンル取得: ' + url);
    var response = this.service.fetch(url, options);
    var responseCode = response.getResponseCode();
    var result = JSON.parse(response.getContentText());

    if (responseCode === 200) {
      console.log('✅ ジャンル取得成功');
      return result;
    } else {
      console.error('❌ ジャンル取得失敗: ' + JSON.stringify(result));
      throw new Error('Failed to get genres');
    }
  } catch (e) {
    console.error('ジャンル取得エラー: ' + e.message);
    throw e;
  }
};
