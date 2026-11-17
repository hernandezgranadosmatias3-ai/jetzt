#!/bin/bash
# Installiert „Jetzt“ als eigenständige App auf deinem iPhone – ohne App Store und ohne
# laufenden Mac danach. Aufruf im Projektordner:  npm run iphone
#
# Einmalig vorher (siehe README, Abschnitt „Auf dein iPhone“):
#   1. Xcode → Einstellungen → Accounts → mit deiner Apple-ID anmelden (kostenlos reicht).
#   2. iPhone per Kabel verbinden, „Diesem Computer vertrauen“, Entwicklermodus einschalten.
#
# Mit kostenloser Apple-ID läuft die Installation 7 Tage. Danach einfach erneut ausführen –
# deine Daten bleiben erhalten.
set -euo pipefail
cd "$(dirname "$0")/.."
export LANG=en_US.UTF-8

BUNDLE_ID="app.jetzt.tagesassistent"
BUILD_DIR="$HOME/Library/Caches/jetzt-iphone-build" # außerhalb von iCloud
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }
fail() { printf '\n\033[31m%s\033[0m\n' "$*" >&2; exit 1; }

# --- 1. iPhone finden -------------------------------------------------------
say "1/4  iPhone suchen …"
xcrun devicectl list devices --json-output "$TMP/devices.json" >/dev/null 2>&1 || true
read -r UDID NAME OS < <(node -e '
  const d = require(process.argv[1]).result.devices;
  const p = d.find((x) => x.hardwareProperties?.reality === "physical" && x.hardwareProperties?.platform === "iOS");
  console.log(p ? [p.hardwareProperties.udid, (p.deviceProperties?.name ?? "iPhone").replace(/\s+/g, "_"), p.deviceProperties?.osVersionNumber ?? "?"].join(" ") : "");
' "$TMP/devices.json" 2>/dev/null || true)
[ -n "${UDID:-}" ] || fail "Kein iPhone gefunden. Per Kabel verbinden, entsperren und „Vertrauen“ tippen. Dann erneut starten."
echo "   ${NAME//_/ } (iOS $OS)"
case "$OS" in
  2[6-9]*|[3-9][0-9]*) ;;
  *) echo "   Hinweis: Echte Wecker (AlarmKit) gibt es ab iOS 26. Auf diesem iPhone weckt dich die App mit Mitteilungen." ;;
esac

# --- 2. Apple-ID / Team finden ---------------------------------------------
say "2/4  Apple-ID prüfen …"
TEAM="${TEAM_ID:-}"
if [ -z "$TEAM" ]; then
  TEAM=$(defaults read com.apple.dt.Xcode IDEProvisioningTeamByIdentifier 2>/dev/null | grep -Eo 'teamID = "?[A-Z0-9]{10}' | head -1 | grep -Eo '[A-Z0-9]{10}$' || true)
fi
if [ -z "$TEAM" ]; then
  TEAM=$(security find-certificate -c "Apple Development" -p 2>/dev/null | openssl x509 -noout -subject 2>/dev/null | grep -Eo 'OU ?= ?[A-Z0-9]{10}' | grep -Eo '[A-Z0-9]{10}$' || true)
fi
[ -n "$TEAM" ] || fail "Keine Apple-ID in Xcode gefunden. Xcode → Einstellungen → Accounts → „+“ → Apple-ID. Dann erneut starten."
echo "   Team $TEAM"

# --- 3. Bauen (Release: JavaScript ist in der App, kein Mac nötig) ----------
if [ ! -d ios/Pods ]; then
  say "Natives Projekt vorbereiten …"
  if [ ! -e ios ]; then
    npx expo prebuild -p ios --no-install
    rm -rf ios.nosync && mv ios ios.nosync && ln -s ios.nosync ios
  fi
  (cd ios && pod install)
fi

say "3/4  App bauen (beim ersten Mal 5–10 Minuten) …"
LOG="$BUILD_DIR/build.log"
mkdir -p "$BUILD_DIR"
if ! xcodebuild \
  -workspace ios/Jetzt.xcworkspace -scheme Jetzt -configuration Release \
  -destination "id=$UDID" -derivedDataPath "$BUILD_DIR" \
  -allowProvisioningUpdates -allowProvisioningDeviceRegistration \
  DEVELOPMENT_TEAM="$TEAM" CODE_SIGN_STYLE=Automatic \
  build >"$LOG" 2>&1; then
  grep -E "error:|requires a development team|Provisioning|No Accounts|not registered" "$LOG" | sort -u | head -15
  fail "Bauen fehlgeschlagen. Vollständiges Protokoll: $LOG"
fi
APP="$BUILD_DIR/Build/Products/Release-iphoneos/Jetzt.app"
[ -d "$APP" ] || fail "App nicht gefunden: $APP"

# --- 4. Installieren und starten -------------------------------------------
say "4/4  Auf dem iPhone installieren …"
xcrun devicectl device install app --device "$UDID" "$APP" >/dev/null
if xcrun devicectl device process launch --device "$UDID" "$BUNDLE_ID" >/dev/null 2>&1; then
  say "Fertig – Jetzt ist geöffnet."
else
  say "Installiert. Beim ersten Mal einmalig erlauben:"
  echo "   iPhone → Einstellungen → Allgemein → VPN und Geräteverwaltung → deine Apple-ID → „Vertrauen“."
  echo "   Danach die App „Jetzt“ auf dem Home-Bildschirm öffnen."
fi
echo
echo "Kostenlose Apple-ID: Die App läuft 7 Tage. Zum Verlängern einfach wieder  npm run iphone  ausführen."
