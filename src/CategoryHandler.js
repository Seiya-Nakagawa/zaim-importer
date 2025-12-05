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
      var mapValue = SHOP_CATEGORY_MAP[shopList[i]];

      // ID直接指定の場合
      if (mapValue.categoryId) {
        return {
          categoryId: mapValue.categoryId,
          genreId: mapValue.genreId
        };
      }

      // 旧互換性: 文字列でカテゴリ名が指定されている場合（念のため残す）
      var categoryName = (typeof mapValue === 'string') ? mapValue : mapValue.category;
      if (categoryName && CATEGORY_MAP[categoryName]) {
        return {
          categoryId: CATEGORY_MAP[categoryName].id,
          genreId: mapValue.genreId ? mapValue.genreId : CATEGORY_MAP[categoryName].genreId
        };
      }
    }
  }

  // 2. リストにない場合はGeminiに問い合わせ
  // 未知の店名については生成AI(Gemini)に判断させる
  console.log('リストにないのでGeminiに問い合わせ: ' + shopName);

  // ZAIM_GENRES から詳細なカテゴリ・ジャンルリストを作成
  var genreOptions = [];
  var categoryIds = Object.keys(ZAIM_GENRES);
  for (var i = 0; i < categoryIds.length; i++) {
    var catId = parseInt(categoryIds[i], 10);
    var catInfo = ZAIM_GENRES[catId];
    var genreIds = Object.keys(catInfo.genres);
    for (var j = 0; j < genreIds.length; j++) {
      var genreId = parseInt(genreIds[j], 10);
      var genreName = catInfo.genres[genreId];
      genreOptions.push(genreId + ":" + catInfo.name + "-" + genreName);
    }
  }
  var genreOptionsStr = genreOptions.join(', ');

  var prompt = "店名「" + shopName + "」の家計簿上の適切なカテゴリとジャンルを、次の中から選んで回答してください。\n" +
               "回答は「カテゴリID,ジャンルID」の形式で返してください（例: 101,10103）。\n" +
               "- 適切なカテゴリもジャンルも特定できる場合: そのカテゴリIDとジャンルIDを返す\n" +
               "- カテゴリは特定できるがジャンルが特定できない場合: カテゴリIDと0を返す（例: 101,0）\n" +
               "- カテゴリもジャンルも特定できない場合: 199,0を返す\n" +
               "選択肢: [" + genreOptionsStr + "]";

  var result = callGeminiApi(prompt);

  // 結果を解析
  if (result) {
    var parts = result.split(',');
    if (parts.length === 2) {
      var targetCategoryId = parseInt(parts[0].trim(), 10);
      var targetGenreId = parseInt(parts[1].trim(), 10);

      // カテゴリIDが「その他」(199)の場合
      if (targetCategoryId === 199) {
        console.log('Geminiの判定: カテゴリ特定不可 → デフォルト（その他）を使用');
        return {
          categoryId: CATEGORY_MAP['その他'].id,
          genreId: CATEGORY_MAP['その他'].genreId
        };
      }

      // ジャンルIDが0の場合、CATEGORY_MAPのgenreIdを使用
      if (targetGenreId === 0) {
        // CATEGORY_MAPからカテゴリ名を検索
        var keys = Object.keys(CATEGORY_MAP);
        for (var i = 0; i < keys.length; i++) {
          if (CATEGORY_MAP[keys[i]].id === targetCategoryId) {
            var categoryName = keys[i];
            console.log('Geminiの判定: カテゴリは特定(' + categoryName + ')、ジャンル不明 → CATEGORY_MAPのgenreIdを使用');
            return {
              categoryId: targetCategoryId,
              genreId: CATEGORY_MAP[categoryName].genreId
            };
          }
        }
      }

      // カテゴリとジャンルの両方が特定できた場合
      // ZAIM_GENRESで該当するジャンルが存在するか確認
      for (var i = 0; i < categoryIds.length; i++) {
        var catId = parseInt(categoryIds[i], 10);
        if (catId === targetCategoryId) {
          var catInfo = ZAIM_GENRES[catId];
          var genreIds = Object.keys(catInfo.genres);

          for (var j = 0; j < genreIds.length; j++) {
            var genreId = parseInt(genreIds[j], 10);
            if (genreId === targetGenreId) {
              console.log('Geminiの判定: ' + catInfo.name + ' - ' + catInfo.genres[genreId] + ' (categoryId: ' + catId + ', genreId: ' + genreId + ')');
              return {
                categoryId: catId,
                genreId: genreId
              };
            }
          }

          // カテゴリは存在するがジャンルが見つからない場合、CATEGORY_MAPのgenreIdを使用
          var keys = Object.keys(CATEGORY_MAP);
          for (var k = 0; k < keys.length; k++) {
            if (CATEGORY_MAP[keys[k]].id === targetCategoryId) {
              console.log('Geminiの判定: カテゴリID ' + targetCategoryId + ' は有効だが、ジャンルID ' + targetGenreId + ' が無効 → CATEGORY_MAPのgenreIdを使用');
              return {
                categoryId: targetCategoryId,
                genreId: CATEGORY_MAP[keys[k]].genreId
              };
            }
          }
        }
      }
    }
  }

  // デフォルト: その他 - その他
  console.log('Geminiの応答を解釈できなかったため、デフォルト（その他）を使用');
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

  if (!GEMINI_API_ENDPOINT) {
    console.error("GEMINI_API_ENDPOINT is not set in Script Properties.");
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
      "temperature": GEMINI_PARAM_TEMPERATURE,
      "maxOutputTokens": GEMINI_PARAM_MAX_TOKENS
    }
  };

  var options = {
    "method": "post",
    "contentType": "application/json",
    "payload": JSON.stringify(payload),
    "muteHttpExceptions": true
  };

  try {
    // Rate Limit対策: 1分間に15回の上限があるため、待機する
    Utilities.sleep(GEMINI_API_WAIT_MS);

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
