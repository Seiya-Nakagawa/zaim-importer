/**
 * Zaim API Client
 */

var ZaimClient = function() {
  this.service = getService();
  this.baseUrl = 'https://api.zaim.net/v2';
};

/**
 * 支払いデータを登録する
 * @param {Object} paymentData - 支払いデータ
 *   - date: 日付 (YYYY-MM-DD形式)
 *   - amount: 金額 (数値)
 *   - shop: 店舗名 (文字列)
 *   - category: カテゴリ (オプション、将来実装予定)
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

  // 送信データの構築
  // category_id, genre_id は一旦仮の値を使用(後でマッピング機能を追加予定)
  var payload = {
    mapping: 1, // 1: 入力されたカテゴリID等を優先
    category_id: 101, // 仮: 食費
    genre_id: 10101, // 仮: 食料品
    amount: paymentData.amount,
    date: paymentData.date,
    place: paymentData.shop,
    comment: 'Created by GAS'
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
 * カテゴリ一覧を取得する(デバッグ・確認用)
 * Zaimに登録されているカテゴリとジャンルの一覧を取得します
 * @return {Object} カテゴリ一覧
 */
ZaimClient.prototype.getCategories = function() {
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
      console.log(JSON.stringify(result, null, 2));
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
