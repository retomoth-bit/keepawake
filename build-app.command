#!/usr/bin/env bash
# =====================================================================
#  Keepawake .app ビルダー（Mac側で一度だけ実行）
#  - server.js を Node不要の単体バイナリに固める（bun使用）
#  - Intel / Apple Silicon 両対応バイナリを1つの .app に同梱
#  - 受信者は「ダブルクリック → 初回だけ許可 → 使う」だけ
#
#  使い方: このファイルをダブルクリック（またはターミナルで bash build-app.command）
#  片方のアーキだけにしてサイズを半分にしたい場合: ARCH=arm64 bash build-app.command
#                                              （arm64 または x64）
# =====================================================================
set -euo pipefail
cd "$(dirname "$0")"

echo "── Keepawake .app ビルド ──"

[ "$(uname)" = "Darwin" ] || { echo "✗ macOS専用です"; exit 1; }
[ -f server.js ] || { echo "✗ 同じフォルダに server.js がありません"; exit 1; }

# --- bun（無ければ導入） ---
if ! command -v bun >/dev/null 2>&1; then
  echo "bun が無いので導入します…"
  curl -fsSL https://bun.sh/install | bash
  export BUN_INSTALL="$HOME/.bun"; export PATH="$BUN_INSTALL/bin:$PATH"
fi
command -v bun >/dev/null 2>&1 || { echo "✗ bun 導入に失敗。https://bun.sh を参照"; exit 1; }
echo "✓ bun $(bun --version)"

APP="Keepawake.app"
rm -rf "$APP" dist; mkdir -p dist "$APP/Contents/MacOS" "$APP/Contents/Resources"

# --- バイナリ生成 ---
BUILD_ARCH="${ARCH:-both}"
build_one () {
  local a="$1"
  echo "  → $a"
  bun build server.js --compile --minify --target="bun-darwin-$a" --outfile "dist/keepawake-$a"
  cp "dist/keepawake-$a" "$APP/Contents/Resources/keepawake-$a"
  chmod +x "$APP/Contents/Resources/keepawake-$a"
  codesign --force -s - "$APP/Contents/Resources/keepawake-$a" 2>/dev/null || true
}
echo "バイナリを生成中…"
case "$BUILD_ARCH" in
  arm64) build_one arm64 ;;
  x64)   build_one x64 ;;
  *)     build_one arm64; build_one x64 ;;
esac

# --- Info.plist ---
cat > "$APP/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>Keepawake</string>
  <key>CFBundleDisplayName</key><string>Keepawake</string>
  <key>CFBundleIdentifier</key><string>com.retomoth.keepawake</string>
  <key>CFBundleVersion</key><string>1.0</string>
  <key>CFBundleShortVersionString</key><string>1.0</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleExecutable</key><string>Keepawake</string>
  <key>LSMinimumSystemVersion</key><string>11.0</string>
  <key>LSUIElement</key><true/>
  <key>NSHighResolutionCapable</key><true/>
</dict>
</plist>
PLIST

# --- 初回セットアップ（root権限で sudoers を1行だけ安全に書く） ---
cat > "$APP/Contents/Resources/setup-sudoers.sh" <<'SETUP'
#!/bin/bash
# osascript の管理者権限経由で root として実行される。引数1 = ユーザー名。
U="$1"; [ -z "$U" ] && exit 1
TMP="$(/usr/bin/mktemp)"
/usr/bin/printf '%s ALL=(root) NOPASSWD: /usr/bin/pmset\n' "$U" > "$TMP"
if /usr/sbin/visudo -cf "$TMP" >/dev/null 2>&1; then
  /usr/bin/install -m 440 -o root -g wheel "$TMP" /etc/sudoers.d/keepawake
fi
/bin/rm -f "$TMP"
SETUP
chmod +x "$APP/Contents/Resources/setup-sudoers.sh"

# --- ランチャー（CFBundleExecutable） ---
cat > "$APP/Contents/MacOS/Keepawake" <<'LAUNCH'
#!/bin/bash
export PATH="/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
BUNDLE="$(cd "$(dirname "$0")/../.." && pwd)"
RES="$BUNDLE/Contents/Resources"

# 受信時に付く検疫フラグを外す（初回の「このまま開く」後、内部バイナリを動かすため）
/usr/bin/xattr -dr com.apple.quarantine "$BUNDLE" 2>/dev/null || true

case "$(/usr/bin/uname -m)" in
  arm64) BIN="$RES/keepawake-arm64" ;;
  *)     BIN="$RES/keepawake-x64" ;;
esac
[ -x "$BIN" ] || BIN="$(/bin/ls "$RES"/keepawake-* 2>/dev/null | /usr/bin/head -1)"

# 初回のみ: pmset をパスワードなしで使えるよう登録（管理者ダイアログ1回）
if [ ! -f /etc/sudoers.d/keepawake ]; then
  U="$(/usr/bin/whoami)"
  /usr/bin/osascript -e "do shell script \"'$RES/setup-sudoers.sh' '$U'\" with administrator privileges" 2>/dev/null || true
fi

# 旧バージョンが入れた常駐サービスがあれば掃除（今は常駐しない方式）
OLDPL="$HOME/Library/LaunchAgents/com.retomoth.keepawake.plist"
if [ -f "$OLDPL" ]; then
  /bin/launchctl unload "$OLDPL" 2>/dev/null || true
  /bin/rm -f "$OLDPL"
  /bin/rm -rf "$HOME/Library/Application Support/Keepawake" 2>/dev/null || true
  /bin/sleep 1
fi

# 既に起動済みなら、ブラウザを開くだけで終了
if /usr/bin/nc -z 127.0.0.1 3939 2>/dev/null; then
  /usr/bin/open "http://127.0.0.1:3939"
  exit 0
fi

# エンジンを独立したセッションとして起動（このアプリを閉じても巻き添えで消えない）。
# ただし常駐はしない：使い終わって「休止＆無人」が続くとエンジンは自分で終了する。
( /usr/bin/perl -MPOSIX -e 'POSIX::setsid(); exec @ARGV' "$BIN" >/dev/null 2>&1 & )

# 起動を待ってブラウザを開く。ランチャー自身はすぐ終了＝“固まった”と誤解されない
for _ in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20; do
  /usr/bin/nc -z 127.0.0.1 3939 2>/dev/null && break
  /bin/sleep 0.25
done
/usr/bin/open "http://127.0.0.1:3939"
exit 0
LAUNCH
chmod +x "$APP/Contents/MacOS/Keepawake"

# --- .app 全体をアドホック署名 ---
codesign --force -s - "$APP" 2>/dev/null || true

# --- 受信者向け説明 ---
cat > "はじめにお読みください.txt" <<'READ'
Keepawake — MacBookの蓋を閉じても作業を続けさせるアプリ
========================================================

【使い方】
1. Keepawake.app をダブルクリックします。

2. 初回だけ「開けません」と警告が出ます。あわてず次の操作を：
   ・「完了」を押す
   ・アップルメニュー →「システム設定」→「プライバシーとセキュリティ」を開く
   ・下の方の『"Keepawake" は開けませんでした』の横の【このまま開く】を押す
   ・Macのパスワード（またはTouch ID）で許可する

3. もう一度パスワードを聞かれたら入力します（初回セットアップです）。

4. ブラウザが開き、まんなかに丸が出ます。
   ・丸を押して【灯る】＝ 蓋を閉じても動き続けます
   ・もう一度押して【消える】＝ ふつうの状態に戻ります

※ パスワードを聞かれるのは初回だけ。次からはダブルクリックだけで開きます。

【終わりたいとき】
   丸を押して【消える】＝休止に戻せば、ふつうの状態です。あとはタブを閉じてOK。

【注意】
   ・蓋を閉じたまま長時間使うと本体が熱くなります。風通しのよい所に。
   ・電源を挿さないと電池を使い切ります。長く使うときは電源に挿してください。
READ

# --- 配布用zip（.app＋説明をまとめる） ---
DIST="Keepawake"; rm -rf "$DIST" "Keepawake配布.zip"
mkdir "$DIST"; cp -R "$APP" "$DIST/"; cp "はじめにお読みください.txt" "$DIST/"
ditto -c -k --keepParent "$DIST" "Keepawake配布.zip"
rm -rf "$DIST" dist "はじめにお読みください.txt"

echo ""
echo "=============================="
echo "  完成しました。"
echo "  フォルダに Keepawake.app と Keepawake配布.zip ができています。"
echo "=============================="
open . 2>/dev/null || true
