/**
 * Category Handler
 * 店名から適切なカテゴリを判定する
 */

/**
 * 店名からカテゴリを決定する
 * ハイブリッド方式:
 * 1. 固定マッピング(SHOP_CATEGORY_MAP)にあればそれを使用（高速・確実）
 * 2. なければGemini APIに問い合わせて推論（柔軟性）
 *
 * @param {string} shopName - 店名
 * @return {Object} {categoryId, genreId}
 */
function getCategory(shopName) {
  // 1. マッピングリストから検索
  // 頻出する店名や、AIが間違えやすい店名は Config.js の SHOP_CATEGORY_MAP に登録しておく
  var shopList = Object.keys(SHOP_CATEGORY_MAP);
  for (var i = 0; i < shopList.length; i++) {
    if (shopName.indexOf(shopList[i]) != -1) {
      var categoryName = SHOP_CATEGORY_MAP[shopList[i]];
      // マッピングされたカテゴリ名からIDを取得
      if (CATEGORY_MAP[categoryName]) {
        return {
          categoryId: CATEGORY_MAP[categoryName].id,
          genreId: CATEGORY_MAP[categoryName].genreId
        };
      }
    }
  }

  // 2. リストにない場合はGeminiに問い合わせ
  // 未知の店名については生成AI(Gemini)に判断させる
  console.log('リストにないのでGeminiに問い合わせ: ' + shopName);

  // Config.js の CATEGORY_MAP から "ID: カテゴリ名" のリストを作成
  var options = [];
  var keys = Object.keys(CATEGORY_MAP);
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    var id = CATEGORY_MAP[key].id;
    options.push(id + ":" + key);
  }
  var optionsStr = options.join(', ');

  var prompt = "店名「" + shopName + "」の家計簿上の適切なカテゴリを、次の中から1つだけ選んで回答してください。回答はカテゴリID（数値）のみを返してください。もし該当しそうなカテゴリがない場合は、「199」（その他）を返してください。\n" +
               "選択肢: [" + optionsStr + "]";

  var resultId = callGeminiApi(prompt);

  // IDからカテゴリ情報を取得して返す
  if (resultId) {
    // 数値として比較するために変換（Geminiが文字列で返す可能性があるため）
    var targetId = parseInt(resultId, 10);
    for (var i = 0; i < keys.length; i++) {
      if (CATEGORY_MAP[keys[i]].id === targetId) {
        return {
          categoryId: CATEGORY_MAP[keys[i]].id,
          genreId: CATEGORY_MAP[keys[i]].genreId
        };
      }
    }
  }

  // デフォルト: その他
  return {
    categoryId: CATEGORY_MAP['その他'].id,
    genreId: CATEGORY_MAP['その他'].genreId
  };
}

/**
 * Gemini APIを呼び出す汎用関数
 * @param {string} prompt - プロンプト
 * @return {string|null} 回答テキスト。エラー時や空の場合はnull
 */
function callGeminiApi(prompt) {
  var apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) {
    console.error("GEMINI_API_KEY is not set in Script Properties.");
    return null;
  }

  var url = GEMINI_API_ENDPOINT + apiKey;

  // リクエストペイロードの作成
  var payload = {
    "contents": [
      {
        "parts": [
          {
            "text": prompt
          }
        ]
      }
    ],
    "generationConfig": {
      "temperature": 0.0,
      "maxOutputTokens": 20
    }
  };

  var options = {
    "method": "post",
    "contentType": "application/json",
    "payload": JSON.stringify(payload),
    "muteHttpExceptions": true
  };

  try {
    // 1. APIにリクエストを送信
    var response = UrlFetchApp.fetch(url, options);

    // 2. 返ってきた結果（文字列）をJSONオブジェクトに変換
    var json = JSON.parse(response.getContentText());

    // 3. エラーが含まれていないかチェック
    if (json.error) {
      console.error("Gemini API Error: " + JSON.stringify(json.error));
      return null;
    }

    // 4. 正しい回答が含まれているかチェックして取り出す
    // 構造: candidates[0] -> content -> parts[0] -> text
    if (json.candidates && json.candidates.length > 0 && json.candidates[0].content && json.candidates[0].content.parts.length > 0) {
      // 余分な空白などを削除して返す
      return json.candidates[0].content.parts[0].text.trim();
    } else {
      console.warn("Geminiからの回答が空でした");
      return null;
    }

  } catch (e) {
    // 通信自体が失敗した場合などのエラー処理
    console.error("Gemini Request Failed: " + e.toString());
    return null;
  }
}
