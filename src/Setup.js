/**
 * Gemini 3 への更新用セットアップスクリプト
 *
 * 使い方:
 * 1. GASエディタでこの関数を選択して実行してください。
 * 2. スクリプトプロパティが更新され、Gemini 3 (gemini-3-flash-preview) が使用されるようになります。
 */
function updateToGemini3() {
  const props = PropertiesService.getScriptProperties();

  // モデルIDを更新
  props.setProperty('GEMINI_MODEL_ID', 'gemini-3-flash-preview');

  // 旧エンドポイント設定がある場合は、新方式（自動構成）を優先させるため削除または明示的にnullにする
  // (設計上、Config.js/CategoryHandler.js で判定するようにしたのでそのままでも動くが、推奨設定に合わせる)
  const currentEndpoint = props.getProperty('GEMINI_API_ENDPOINT');
  if (currentEndpoint) {
    console.log('既存のエンドポイント設定をバックアップ： ' + currentEndpoint);
    props.setProperty('GEMINI_API_ENDPOINT_BACKUP', currentEndpoint);
    // props.deleteProperty('GEMINI_API_ENDPOINT'); // 完全に消すと戻せないのでバックアップに留める
  }

  console.log('Gemini 3 への設定更新が完了しました。');
  console.log('Model ID: gemini-3-flash-preview');
}

/**
 * 動作確認用テスト
 * カテゴリ判定が動作するかチェックする
 */
function testGemini3() {
  const testShop = "セブンイレブン";
  console.log('テスト実行: 店舗名「' + testShop + '」');
  try {
    const result = getCategory(testShop);
    console.log('判定結果: categoryId=' + result.categoryId + ', genreId=' + result.genreId);

    if (result.categoryId && result.genreId) {
      console.log('✅ 正常に動作しています。');
    } else {
      console.log('❌ 判定結果が不正です。');
    }
  } catch (e) {
    console.error('❌ エラーが発生しました: ' + e.message);
  }
}
