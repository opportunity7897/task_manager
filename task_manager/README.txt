Local Task Manager Electron版

概要:
ローカル専用のタスク管理ツールです。
ユーザー認証、外部DB、クラウド同期はありません。
データは tasks.json に保存します。

保存先:
開発実行時:
  このプロジェクトフォルダ内の tasks.json

exe化後:
  LocalTaskManager.exe と同じフォルダ内の tasks.json

初回セットアップ:
Node.js が入っている状態で、このフォルダをPowerShellまたはコマンドプロンプトで開き、次を実行します。

npm install

開発実行:
npm start

exe化:
npm run dist

exe化後:
dist フォルダ内に LocalTaskManager.exe が作成されます。
その exe を任意のフォルダへ置いて起動してください。
初回起動時に、exeと同じフォルダへ tasks.json が作成されます。

ファイル構成:
package.json   Electron設定とビルド設定
main.js        Electron本体、JSON読み書き
preload.js     画面とmain.jsの安全な橋渡し
index.html     画面本体
style.css      デザイン
app.js         画面操作
tasks.json     タスクと設定の保存先

注意:
index.htmlを直接ダブルクリックして開く方式ではありません。
npm start または exe から起動してください。
