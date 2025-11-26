/**
 * Email Parsers
 */
const Parsers = {
  /**
   * 共通のパース結果を整形する
   * @private
   * @param {Array|null} shopMatch - 店舗名のマッチ結果
   * @param {Array|null} amountMatch - 金額のマッチ結果
   * @return {Object} 整形されたパース結果
   */
  _formatResult: function(shopMatch, amountMatch) {
    var shop = shopMatch ? shopMatch[1].trim() : null;
    var amount = amountMatch ? parseInt(amountMatch[1].replace(/,/g, ''), 10) : 0;

    return {
      shop: shop,
      amount: amount
    };
  },

  /**
   * 楽天ペイ(実店舗)のメールをパース
   * @param {string} body - メール本文
   * @return {Object} パース結果 {shop, amount}
   */
  rakutenPay: function(body) {
    var shopMatch = body.match(/ご利用店舗\s+(.+?)\s+電話番号/);
    var amountMatch = body.match(/決済総額\s+([\d,]+)円/);

    return this._formatResult(shopMatch, amountMatch);
  },

  /**
   * 楽天ペイ(オンライン決済)のメールをパース
   * @param {string} body - メール本文
   * @return {Object} パース結果 {shop, amount}
   */
  rakutenPayOnline: function(body) {
    // HTMLメールから店舗名を抽出: 提携サイト「店舗名」の形式
    var shopMatch = body.match(/提携サイト[「『](.+?)[」』]/);

    // HTMLタグを除去する処理
    var shop = null;
    if (shopMatch) {
      // HTMLタグを除去: <tag>...</tag> や <tag attr="..."> などを削除
      shop = shopMatch[1].replace(/<[^>]+>/g, '').trim();
    }

    // HTMLタグを全て除去してから金額を抽出
    // HTMLメールでは金額が別のtdタグ内にあるため、タグを除去してからマッチング
    var cleanBody = body.replace(/<[^>]+>/g, ' ');  // HTMLタグを空白に置換

    // お支払い金額を抽出(HTMLタグ除去後のテキストから)
    var amountMatch = cleanBody.match(/お支払い金額[：:]*\s*([\d,]+)円/) ||
                      cleanBody.match(/小計[：:]*\s*([\d,]+)円/);

    var amount = amountMatch ? parseInt(amountMatch[1].replace(/,/g, ''), 10) : 0;

    return {
      shop: shop,
      amount: amount
    };
  },
};
