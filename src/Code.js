/**
 * Zaim Email Importer
 * Main entry point
 */

/**
 * メイン関数
 * 1. 「家計簿/未処理」ラベルのメールを取得
 * 2. 設定されたメールタイトルごとにメールを検索・解析
 * 3. 店名からカテゴリを自動判定（Gemini連携）
 * 4. Zaim APIへ支払情報を登録
 * 5. 処理済みメールのラベルを「家計簿/処理済」に変更
 */
function main() {
  // 1. Gmailラベルを取得（なければ作成）
  var unprocessedLabel = GmailApp.getUserLabelByName(GMAIL_LABEL_UNPROCESSED);
  if (!unprocessedLabel) {
    console.log('ラベル「' + GMAIL_LABEL_UNPROCESSED + '」が見つかりません。処理を終了します。');
    return;
  }

  var processedLabel = GmailApp.getUserLabelByName(GMAIL_LABEL_PROCESSED);
  if (!processedLabel) {
    processedLabel = GmailApp.createLabel(GMAIL_LABEL_PROCESSED);
    console.log('ラベル「' + GMAIL_LABEL_PROCESSED + '」を作成しました。');
  }

  // 2. 未処理ラベルの付いたスレッドを取得
  var threads = unprocessedLabel.getThreads(0, SEARCH_MAX_COUNT);
  console.log('未処理メール件数: ' + threads.length);

  if (threads.length === 0) {
    console.log('処理対象のメールがありません。');
    return;
  }

  // 全ての結果を格納する配列を用意（メッセージ情報も含める）
  var allResults = [];
  // 処理済みにマークするスレッドを記録
  var processedThreads = [];

  // 3. 各スレッドを処理
  threads.forEach(function(thread) {
    var messages = thread.getMessages();
    var threadHasData = false;

    messages.forEach(function(message) {
      // メールの件名を取得
      var subject = message.getSubject();

      // 設定されたメールタイトルと照合
      var keys = Object.keys(PAYMENT_MAILTITLE_MAP);
      var matched = false;

      for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        var expectedSubject = PAYMENT_MAILTITLE_MAP[key].subj;

        // 件名が一致するか確認（部分一致）
        if (subject.indexOf(expectedSubject) !== -1) {
          matched = true;
          console.log('件名一致: ' + subject + ' (タイプ: ' + key + ')');

          // メール検索と解析を実行
          var result = searchMailsFromMessage(message, key);

          if (result.length > 0) {
            // 支払い元情報を付与
            var sourceName = PAYMENT_MAILTITLE_MAP[key].name;
            result.forEach(function(item) {
              item.paymentSource = sourceName;
              item.message = message; // メッセージ情報を保持（後でラベル変更に使用）
              item.thread = thread; // スレッド情報を保持（後でラベル変更に使用）
            });

            allResults = allResults.concat(result);
            threadHasData = true;

            // ログ出力用にメッセージ・スレッド情報を除外したコピーを作成
            var logResult = result.map(function(item) {
              var logItem = {};
              for (var prop in item) {
                if (prop !== 'message' && prop !== 'thread') {
                  logItem[prop] = item[prop];
                }
              }
              return logItem;
            });
            console.log('検索結果: ' + JSON.stringify(logResult));
          }

          break;
        }
      }

      if (!matched) {
        console.log('未対応のメールタイトル: ' + subject);
      }
    });

    // データが取得できたスレッドを記録
    if (threadHasData) {
      processedThreads.push(thread);
    }
  });

  // 全検索結果を出力（メッセージ・スレッド情報は除外）
  var logResults = allResults.map(function(item) {
    var logItem = {};
    for (var prop in item) {
      if (prop !== 'message' && prop !== 'thread') {
        logItem[prop] = item[prop];
      }
    }
    return logItem;
  });
  console.log('全検索結果: ' + JSON.stringify(logResults));

  if (allResults.length === 0) {
    console.log('処理対象のデータがありません。');
    return;
  }

  // 4. カテゴリ判定を実行
  // 店名(shop)を元に、ZaimのカテゴリIDとジャンルIDを決定する
  allResults.forEach(function(item) {
    if (item.skipZaim) return;

    // CategoryHandler.js の関数を呼び出す
    // 戻り値: {categoryId: 数値, genreId: 数値}
    // まずマッピング(SHOP_CATEGORY_MAP)を確認し、なければGemini APIに問い合わせる
    var categoryInfo = getCategory(item.shop);
    item.categoryId = categoryInfo.categoryId;
    item.genreId = categoryInfo.genreId;
  });

  // カテゴリ付与後（メッセージ・スレッド情報は除外）:
  var logResultsAfterCategory = allResults.map(function(item) {
    var logItem = {};
    for (var prop in item) {
      if (prop !== 'message' && prop !== 'thread') {
        logItem[prop] = item[prop];
      }
    }
    return logItem;
  });
  console.log('カテゴリ付与後: ' + JSON.stringify(logResultsAfterCategory));

  // 5. Zaimに登録
  var zaim = new ZaimClient();
  var successCount = 0;
  var failCount = 0;

  allResults.forEach(function(item) {
    if (item.skipZaim) {
      console.log('Zaim登録スキップ: ' + item.shop);
      return;
    }

    try {
      // 登録処理 (ZaimClient.js)
      zaim.registerPayment(item);
      successCount++;
      // APIレート制限考慮のため少し待機
      Utilities.sleep(ZAIM_API_WAIT_MS);
    } catch (e) {
      failCount++;
      console.error('登録失敗: ' + JSON.stringify(item) + ' Error: ' + e.message);
    }
  });

  console.log('Zaim登録結果: 成功=' + successCount + ', 失敗=' + failCount);

  // 6. 処理済みスレッドのラベルを変更（重複を排除）
  var labelChangedCount = 0;
  var processedThreadIds = {};

  processedThreads.forEach(function(thread) {
    var threadId = thread.getId();
    // 既に処理済みのスレッドはスキップ
    if (processedThreadIds[threadId]) {
      return;
    }
    processedThreadIds[threadId] = true;

    try {
      thread.removeLabel(unprocessedLabel);
      thread.addLabel(processedLabel);
      labelChangedCount++;
      console.log('ラベル変更: スレッドID=' + threadId);
    } catch (e) {
      console.error('ラベル変更失敗: スレッドID=' + threadId + ' Error: ' + e.message);
    }
  });

  console.log('ラベル変更完了: ' + labelChangedCount + '件のスレッドを処理済みに変更しました。');
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
 * メッセージから解析結果を取得する
 * @param {GmailMessage} message - Gmailメッセージオブジェクト
 * @param {string} key - PAYMENT_MAILTITLE_MAPのキー
 * @return {Array} 解析結果の配列
 */
function searchMailsFromMessage(message, key) {
  var results = [];

  // 本文を取得
  var body = message.getPlainBody();
  console.log('メール本文: ' + body.substring(0, 200) + '...'); // 最初の200文字のみログ出力

  // メール本文を解析
  var data = Parsers[key](body);
  console.log('解析結果: ' + JSON.stringify(data));

  // 解析結果を結果配列に追加
  if (data) {
    // パーサーが配列を返す場合（楽天カードのまとめ版など）と
    // 単一オブジェクトを返す場合の両方に対応
    var items = Array.isArray(data) ? data : [data];

    items.forEach(function(item) {
      // パーサーが日付を返していればそれを使い、なければメッセージの日付を使う
      if (!item.date) {
        var messageDate = message.getDate();
        item.date = Utilities.formatDate(messageDate, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      }
      results.push(item);
    });
  }

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
