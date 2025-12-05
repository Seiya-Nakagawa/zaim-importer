/**
 * Zaim Email Importer
 * Main entry point
 */

/**
 * メイン関数
 * 1. 検索対象の日付を取得
 * 2. 設定されたメールタイトルごとにメールを検索・解析
 * 3. 店名からカテゴリを自動判定（Gemini連携）
 * 4. Zaim APIへ支払情報を登録
 */
function main() {
  // 1. メール取得対象の日付を取得(YYYY/MM/DD)
  // Config.js の SEARCH_TARGET_DAYS_AGO (またはプロパティ) で指定された日数前を基準にする
  var targetDateStr = getDateStr(SEARCH_TARGET_DAYS_AGO);

  // 全ての結果を格納する配列を用意
  var allResults = [];

  // 2. 対象のメールタイトルで検索
  // Config.js の PAYMENT_MAILTITLE_MAP に定義された各メールタイプについて処理
  var keys = Object.keys(PAYMENT_MAILTITLE_MAP);
  keys.forEach(function(key) {
    // メール検索と解析を実行 (Parsers.js の対応するパーサーが呼ばれる)
    var result = searchMails(key, targetDateStr);
    console.log('検索結果: ' + JSON.stringify(result));

    // 取得した結果を全体の配列に結合（追加）する
    if (result.length > 0) {
      // 支払い元情報を付与
      var sourceName = PAYMENT_MAILTITLE_MAP[key].name;
      result.forEach(function(item) {
        item.paymentSource = sourceName;
      });

      allResults = allResults.concat(result);
    }
  });

  // 全検索結果を出力
  console.log('全検索結果: ' + JSON.stringify(allResults));

  // 3. カテゴリ判定を実行
  // 店名(shop)を元に、ZaimのカテゴリIDとジャンルIDを決定する
  allResults.forEach(function(item) {
    // CategoryHandler.js の関数を呼び出す
    // 戻り値: {categoryId: 数値, genreId: 数値}
    // まずマッピング(SHOP_CATEGORY_MAP)を確認し、なければGemini APIに問い合わせる
    var categoryInfo = getCategory(item.shop);
    item.categoryId = categoryInfo.categoryId;
    item.genreId = categoryInfo.genreId;
  });

  // カテゴリ付与後:
  console.log('カテゴリ付与後: ' + JSON.stringify(allResults));

  // 4. Zaimに登録
  var zaim = new ZaimClient();
  allResults.forEach(function(item) {
    try {
      // 登録処理 (ZaimClient.js)
      zaim.registerPayment(item);
      // APIレート制限考慮のため少し待機
      Utilities.sleep(ZAIM_API_WAIT_MS);
    } catch (e) {
      console.error('登録失敗: ' + JSON.stringify(item) + ' Error: ' + e.message);
    }
  });
}

/**
 * 指定した日数前の日付文字列を取得する
 * @param {number} daysAgo - 何日前か
 * @return {string} YYYY/MM/DD形式の日付文字列
 */
function getDateStr(daysAgo) {
  var date = new Date();
  date.setDate(date.getDate() - daysAgo);
  var dateStr = Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return dateStr;
}

/**
 * メールを検索し、解析結果をログ出力する
 * @param {string} key - PAYMENT_MAILTITLE_MAPのキー
 * @param {string} targetDateStr - 検索対象の日付文字列(YYYY/MM/DD)
 */
function searchMails(key, targetDateStr) {
  var results = [];
  // 検索するメールの件名を取得
  var subject = PAYMENT_MAILTITLE_MAP[key].subj;
  console.log('件名: ' + subject);

  // 検索条件を組み立てる
  var query = 'subject:' + subject + ' after:' + targetDateStr;
  console.log('検索条件: ' + query);

  // 検索を実行
  var threads = GmailApp.search(query, SEARCH_START_INDEX, SEARCH_MAX_COUNT);
  console.log('検索結果件数: ' + threads.length);

  // 各スレッド・メッセージを処理
  threads.forEach(function(thread) {
    var messages = thread.getMessages();

    messages.forEach(function(message){
      // 本文を取得
      var body = message.getPlainBody();
      console.log('メール本文: ' + body);

      // メール本文を解析
      var data = Parsers[key](body);
      console.log('解析結果: ' + JSON.stringify(data));

      // 解析結果を結果配列に追加
      if (data) {
        // パーサーが配列を返す場合（楽天カードのまとめ版など）と
        // 単一オブジェクトを返す場合の両方に対応
        var items = Array.isArray(data) ? data : [data];

        items.forEach(function(item) {
          // パーサーが日付を返していればそれを使い、なければ検索対象日を使う
          item.date = item.date || targetDateStr;
          results.push(item);
        });
      }
    })
  })

  return results;
}

/**
 * カテゴリ一覧を確認するための関数
 * 実行後、ログを確認してください
 */
function checkCategories() {
  var zaim = new ZaimClient();
  var catData = zaim.getCategories();
  var genData = zaim.getGenres();

  console.log('--- カテゴリ・ジャンル一覧 ---');
  if (catData && catData.categories) {
    catData.categories.forEach(function(cat) {
      console.log('カテゴリ: ' + cat.name + ' (ID: ' + cat.id + ')');

      if (genData && genData.genres) {
        var genres = genData.genres.filter(function(g) {
          return g.category_id === cat.id;
        });

        genres.forEach(function(gen) {
          console.log('  └ ジャンル: ' + gen.name + ' (ID: ' + gen.id + ')');
        });
      }
    });
  }
}

/**
 * GASから登録したデータを削除する（クリーンアップ用）
 * 指定した日数分のデータから、コメントに "Created by GAS" を含むものを削除します
 * @param {number} daysAgo - 何日前まで遡るか（デフォルト: SEARCH_TARGET_DAYS_AGO）
 */
function deleteGasPayments(daysAgo) {
  var zaim = new ZaimClient();

  // 引数がなければ Config.js の設定値を使用
  var targetDays = daysAgo || DELETE_TARGET_DAYS_AGO;

  // 検索期間の設定
  var endDate = new Date();
  var startDate = new Date();
  startDate.setDate(endDate.getDate() - targetDays);

  var params = {
    mapping: 1,
    start_date: Utilities.formatDate(startDate, Session.getScriptTimeZone(), 'yyyy-MM-dd'),
    end_date: Utilities.formatDate(endDate, Session.getScriptTimeZone(), 'yyyy-MM-dd'),
    limit: ZAIM_SEARCH_LIMIT // 一度の取得件数上限
  };

  console.log('削除対象データの検索開始: ' + params.start_date + ' 〜 ' + params.end_date);

  var data = zaim.getMoney(params);

  if (!data || !data.money || data.money.length === 0) {
    console.log('データが見つかりませんでした。');
    return;
  }

  var deleteCount = 0;

  data.money.forEach(function(item) {
    // コメントに "Created by GAS" が含まれているかチェック
    if (item.comment && item.comment.indexOf(ZAIM_COMMENT_PREFIX) !== -1) {
      console.log('削除対象発見: ' + item.date + ' ' + item.place + ' ' + item.amount + '円 (ID: ' + item.id + ')');

      // 削除実行
      if (zaim.deletePayment(item.id)) {
        deleteCount++;
        // APIレート制限考慮
        Utilities.sleep(ZAIM_DELETE_WAIT_MS);
      }
    }
  });

  console.log('削除完了: ' + deleteCount + '件のデータを削除しました。');
}
