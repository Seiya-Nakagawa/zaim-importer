/**
 * Email Parsers
 */
var Parsers = {
  /**
   * 楽天ペイ（アプリ決済）の解析
   * @param {string} body - メール本文
   * @return {Object|null} 解析結果 {shop: "店名", amount: 1000, date: "YYYY-MM-DD"}
   */
  rakutenPay: function(body) {
    // 店名の抽出
    var shopMatch = body.match(/ご利用店舗\s+([^\r\n]+)/);
    var shop = shopMatch ? shopMatch[1].trim() : null;

    // 金額の抽出
    var amountMatch = body.match(/決済総額\s+([\d,]+)円/);
    var amount = amountMatch ? parseInt(amountMatch[1].replace(/,/g, ''), 10) : null;

    // 日時の抽出 (例: 2025/11/29(土) 10:36)
    var dateMatch = body.match(/ご利用日時\s+(\d{4}\/\d{1,2}\/\d{1,2})/);
    var date = dateMatch ? dateMatch[1].replace(/\//g, '-') : null;

    if (shop && amount) {
      return {
        shop: shop,
        amount: amount,
        date: date
      };
    }
    return null;
  },

  /**
   * 楽天ペイ（オンライン決済）の解析
   * HTMLメールのため、タグを除去してから情報を抽出します
   * @param {string} body - メール本文
   * @return {Object|null} 解析結果 {shop: "店名", amount: 1000, date: "YYYY-MM-DD"}
   */
  rakutenPayOnline: function(body) {
    // HTMLタグを除去してプレーンテキスト化
    // <...> の形式のタグを全て削除
    var plainBody = body.replace(/<[^>]*>/g, '');

    // 店名の抽出
    // パターン: 提携サイト「〇〇」にて
    var shopMatch = plainBody.match(/提携サイト「([^」]+)」/);
    var shop = shopMatch ? shopMatch[1].trim() : null;

    // 日時の抽出
    // パターン: ご注文日： 2025-11-25 21:06:02
    var dateMatch = plainBody.match(/ご注文日：\s*(\d{4}-\d{1,2}-\d{1,2})/);
    var date = dateMatch ? dateMatch[1] : null;

    // 金額の抽出
    // パターン1: 注文合計 2,110円
    var amount = null;
    var amountMatch = plainBody.match(/注文合計\s*([\d,]+)円/);

    if (amountMatch) {
      amount = parseInt(amountMatch[1].replace(/,/g, ''), 10);
    } else {
      // パターン1で見つからない場合（明細のみの場合など）
      // 明細行の「＝ X,XXX円」を全て合計して算出する
      // 例: 2,000円 × 1個 ＝ 2,000円
      var lineMatches = plainBody.match(/＝\s*([\d,]+)円/g);
      if (lineMatches) {
        amount = 0;
        lineMatches.forEach(function(match) {
          // "＝ 2,000円" から "2000" を抽出
          var val = match.match(/([\d,]+)/)[1].replace(/,/g, '');
          amount += parseInt(val, 10);
        });
      }
    }

    // 必須項目（店名と金額）が取れている場合のみ結果を返す
    if (shop && amount) {
      return {
        shop: shop,
        amount: amount,
        date: date
      };
    }
    return null;
  },

  /**
   * 楽天カード（まとめ版）の解析
   * 各明細が縦並び形式（■利用日、■利用先、■利用金額が改行区切り）
   * @param {string} body - メール本文
   * @return {Array|null} 解析結果の配列 [{shop: "店名", amount: 1000, date: "YYYY-MM-DD"}, ...]
   */
  rakutenCard: function(body) {
    var results = [];

    console.log('RakutenCard body length: ' + body.length);

    // 各明細ブロックを抽出
    // パターン: ■利用日: から次の■利用日: または文末まで
    var blocks = body.split(/(?=■利用日:)/);

    console.log('RakutenCard blocks found: ' + blocks.length);

    blocks.forEach(function(block, index) {
      if (!block.trim() || block.indexOf('■利用日:') === -1) {
        return; // 空ブロックまたは利用日がないブロックはスキップ
      }

      // 日付の抽出
      var dateMatch = block.match(/■利用日:\s*(\d{4}\/\d{1,2}\/\d{1,2})/);
      var date = dateMatch ? dateMatch[1].replace(/\//g, '-') : null;

      // 店名の抽出
      var shopMatch = block.match(/■利用先:\s*([^\r\n]+)/);
      var shop = shopMatch ? shopMatch[1].trim() : null;

      // 金額の抽出
      var amountMatch = block.match(/■利用金額:\s*([\d,]+)/);
      var amount = amountMatch ? parseInt(amountMatch[1].replace(/,/g, ''), 10) : null;

      console.log('Block ' + index + ': date=' + date + ', shop=' + shop + ', amount=' + amount);

      // 店名と金額が両方取得できた場合のみ登録
      if (shop && amount && date) {
        // Zaim登録をスキップする条件（楽天キャッシュ、楽天証券投信積立など）
        // 処理済みラベルは付与したいため、結果には含めるが skipZaim フラグを立てる
        var skipZaim = (shop.indexOf('楽天キャッシュ') !== -1) || (shop.indexOf('楽天証券投信積立') !== -1);

        results.push({
          shop: shop,
          amount: amount,
          date: date,
          skipZaim: skipZaim
        });

        if (skipZaim) {
          console.log('Added to results (Skip Zaim: ' + shop + ')');
        } else {
          console.log('Added to results');
        }
      } else {
        console.log('Skipped (missing required fields)');
      }
    });

    console.log('RakutenCard total results: ' + results.length);

    return results.length > 0 ? results : null;
  }
};
