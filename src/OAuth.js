/**
 * OAuth1.0a authentication for Zaim
 *
 * 【使用前の準備】
 * 1. GASエディタで「ライブラリ」から以下を追加:
 *    - スクリプトID: 1CXDCY5sqT9ph64fFwSzVtXnbjpSfWdRymafDrtIZ7Z_hwysTY7IIhi7s
 *    - 識別子: OAuth1
 *
 * 2. スクリプトプロパティに以下を設定:
 *    - ZAIM_CONSUMER_KEY: ZaimのConsumer Key
 *    - ZAIM_CONSUMER_SECRET: ZaimのConsumer Secret
 *
 * 3. Webアプリとしてデプロイ:
 *    - 「デプロイ」→「新しいデプロイ」
 *    - 種類: Webアプリ
 *    - 実行ユーザー: 自分
 *    - アクセスできるユーザー: 自分のみ
 */

/**
 * OAuth1サービスを作成する
 * @return {OAuth1.Service}
 */
function getService() {
  var props = PropertiesService.getScriptProperties();
  var consumerKey = props.getProperty('ZAIM_CONSUMER_KEY');
  var consumerSecret = props.getProperty('ZAIM_CONSUMER_SECRET');

  // 認証情報の存在チェック
  if (!consumerKey || !consumerSecret) {
    throw new Error(
      'Zaim認証情報が設定されていません。\n' +
      'スクリプトプロパティに以下を設定してください:\n' +
      '- ZAIM_CONSUMER_KEY\n' +
      '- ZAIM_CONSUMER_SECRET'
    );
  }

  return OAuth1.createService('Zaim')
    // 認証のエンドポイントURLを設定
    .setRequestTokenUrl('https://api.zaim.net/v2/auth/request')
    .setAccessTokenUrl('https://api.zaim.net/v2/auth/access')
    .setAuthorizationUrl('https://auth.zaim.net/users/auth')

    // コンシューマーキーとシークレットを設定
    .setConsumerKey(consumerKey)
    .setConsumerSecret(consumerSecret)

    // コールバック関数の名前を指定
    .setCallbackFunction('authCallback')

    // アクセストークンを保存するプロパティストアを指定
    .setPropertyStore(props);
}

/**
 * Webアプリのエントリーポイント
 * OAuth認証のコールバックを受け取るために必要
 * @param {Object} e - リクエストパラメータ
 * @return {HtmlOutput}
 */
function doGet(e) {
  return authCallback(e);
}

/**
 * 認証コールバック処理
 * OAuth認証後にZaimからリダイレクトされた際に実行される
 * @param {Object} request - リクエストオブジェクト
 * @return {HtmlOutput}
 */
function authCallback(request) {
  try {
    var service = getService();
    var isAuthorized = service.handleCallback(request);

    if (isAuthorized) {
      console.log('OAuth認証成功: アクセストークンを取得しました');
      return HtmlService.createHtmlOutput(
        '<h1>✅ 認証に成功しました</h1>' +
        '<p>このタブを閉じて、GASエディタに戻ってください。</p>' +
        '<script>setTimeout(function() { window.close(); }, 3000);</script>'
      );
    } else {
      console.error('OAuth認証失敗: トークン取得に失敗しました');
      return HtmlService.createHtmlOutput(
        '<h1>❌ 認証に失敗しました</h1>' +
        '<p>もう一度 printAuthUrl() を実行してやり直してください。</p>'
      );
    }
  } catch (error) {
    console.error('authCallback エラー: ' + error.message);
    return HtmlService.createHtmlOutput(
      '<h1>❌ エラーが発生しました</h1>' +
      '<p>' + error.message + '</p>'
    );
  }
}

/**
 * 認証URLをログに出力する
 * 初回実行時やトークン切れの際に実行する
 *
 * 【使い方】
 * 1. この関数を実行
 * 2. ログに表示されたURLをブラウザで開く
 * 3. Zaimで「許可」をクリック
 * 4. 自動的にコールバックが実行され、トークンが保存される
 */
function printAuthUrl() {
  try {
    var service = getService();

    if (service.hasAccess()) {
      console.log('✅ すでに認証済みです。');
      console.log('認証を解除する場合は resetAuth() を実行してください。');
      return;
    }

    var authorizationUrl = service.authorize();
    console.log('========================================');
    console.log('📌 以下のURLを開いて認証してください:');
    console.log('========================================');
    console.log(authorizationUrl);
    console.log('========================================');
    console.log('認証後、自動的にトークンが保存されます。');

  } catch (error) {
    console.error('❌ 認証URL取得エラー: ' + error.message);
    console.error('スクリプトプロパティの設定を確認してください。');
  }
}

/**
 * 認証状態を確認する
 * @return {boolean} 認証済みの場合true
 */
function checkAuthStatus() {
  try {
    var service = getService();
    var hasAccess = service.hasAccess();

    if (hasAccess) {
      console.log('✅ 認証済み: Zaim APIを使用できます');
    } else {
      console.log('❌ 未認証: printAuthUrl() を実行して認証してください');
    }

    return hasAccess;
  } catch (error) {
    console.error('❌ 認証状態確認エラー: ' + error.message);
    return false;
  }
}

/**
 * 認証を解除する(デバッグ用)
 * 保存されているアクセストークンを削除します
 */
function resetAuth() {
  try {
    var service = getService();
    service.reset();
    console.log('✅ 認証を解除しました。');
    console.log('再度認証する場合は printAuthUrl() を実行してください。');
  } catch (error) {
    console.error('❌ 認証解除エラー: ' + error.message);
  }
}
