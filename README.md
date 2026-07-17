# Keepawake

MacBookの蓋を閉じても、作業（アップロードや書き出しなど）を止めずに続けさせる小さなアプリ。
ノート1台での持ち運びに便利です。**macOS専用**（Intel / Apple Silicon 両対応）。

*English below ↓*

---

## ⚠️ はじめに（大切）

これは個人が作った**署名なしの無料アプリ**です。そのため初回だけ、macOSの警告を手動で許可する
必要があります（下記手順）。**無保証・自己責任**でご利用ください。作者は本アプリの使用によって
生じたいかなる不具合・損害についても責任を負いません。不安な方は、Mac App Storeの
「Amphetamine」など署名済みの無料アプリのご利用をおすすめします。

---

## ダウンロード

右の [Releases](../../releases) から最新の `Keepawake配布.zip` をダウンロードし、解凍してください。
中に `Keepawake.app` と、この説明が入っています。

## 使い方

1. `Keepawake.app` をダブルクリック。

2. 初回だけ「開けません（開発元を確認できない）」と出ます。あわてず:
   - 「完了」を押す
   - アップルメニュー →「システム設定」→「プライバシーとセキュリティ」を開く
   - 下の方の『"Keepawake" は開けませんでした』の横の **「このまま開く」** を押す
   - Macのパスワード（またはTouch ID）で許可

3. もう一度パスワードを聞かれたら入力（初回セットアップです）。

4. ブラウザが開き、まんなかに丸が出ます。
   - 丸を押して **灯る** ＝ 蓋を閉じても動き続ける（覚醒）
   - もう一度押して **消える** ＝ 通常どおりスリープ（休止）

初回だけパスワードを2回聞かれます。次回からはダブルクリックだけで開きます。

## 使うときの注意

- 蓋を閉じたまま長く使うと本体が熱くなります。風通しのよい場所に置いてください。
- 電源を挿さないと電池を使い切ります。長く使うときは電源に挿してください。
- 外部モニターを使うときは、macOS標準のクラムシェルモードで動くので、このアプリは不要です。

## 仕組み

macOS標準の `pmset -a disablesleep 1/0` を切り替えているだけです。丸を「消す（休止）」に
すれば通常状態に戻ります。使っていないとき（休止＆画面を閉じた状態）は、内部のプログラムが
自動で終了します。

## 自分でビルドする（任意・上級者向け）

`server.js` と `build-app.command` を同じフォルダに置き、`bash build-app.command` を実行すると
`Keepawake.app` が生成されます（[bun](https://bun.sh) を使用）。

---
---

# Keepawake (English)

A small app that keeps your MacBook running with the lid closed, so tasks like uploads or
exports don't stop when you close it. Handy for carrying a single laptop around.
**macOS only** (works on both Intel and Apple Silicon).

---

## ⚠️ Please read first

This is a **free, unsigned app made by an individual**. Because it isn't signed, you'll need to
approve a macOS warning by hand the first time (steps below). Use it **at your own risk, with no
warranty** — the author is not responsible for any problems or damage arising from its use.
If you'd rather avoid the warning, a signed free app such as **Amphetamine** on the Mac App Store
is a good alternative.

---

## Download

Grab the latest `Keepawake配布.zip` from [Releases](../../releases) and unzip it. Inside you'll
find `Keepawake.app` and these instructions.

## How to use

1. Double-click `Keepawake.app`.

2. The first time, macOS will say it can't be opened (unidentified developer). Don't worry:
   - Click "Done"
   - Open the Apple menu → **System Settings** → **Privacy & Security**
   - Scroll down and click **"Open Anyway"** next to the message about "Keepawake"
   - Authorize with your Mac password (or Touch ID)

3. If asked for your password again, enter it (this is the one-time setup).

4. Your browser opens with a circle in the middle.
   - Press it so it **glows** = stays awake even with the lid closed
   - Press again so it **dims** = sleeps normally

You'll be asked for your password twice on the first run only. After that, just double-click.

## Notes

- Running with the lid closed for long periods makes the Mac warm. Keep it somewhere well-ventilated.
- It won't sleep, so on battery it will drain. Keep it plugged in for long sessions.
- With an external monitor, macOS's built-in clamshell mode already handles this, so the app isn't needed.

## How it works

It simply toggles the built-in macOS setting `pmset -a disablesleep 1/0`. Dimming the circle
returns things to normal. When it isn't in use (dimmed and the page closed), the small helper
process quits itself automatically.

## Build it yourself (optional, advanced)

Put `server.js` and `build-app.command` in the same folder and run `bash build-app.command` to
generate `Keepawake.app` (uses [bun](https://bun.sh)).

---

無保証 / No warranty: This software is provided "as is", without warranty of any kind.
