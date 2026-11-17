# Jetzt – Tagesassistent

Minimalistische Routine-, Wecker- und Produktivitäts-App für iOS und Android
(React Native, Expo SDK 58, TypeScript). Die App beantwortet jederzeit eine Frage:
**„Was sollte ich jetzt gerade tun?“**

## Funktionsumfang

| Bereich | Umgesetzt |
| --- | --- |
| **Heute** | Begrüßung, Datum/Uhrzeit, Tagesfortschritt in %, „x von y erledigt“, Karte *Jetzt an der Reihe* (Start, Dauer, verbleibende Zeit, Starten / Erledigt / Verlängern / Überspringen), nächste Aufgabe, Tagesübersicht mit hervorgehobener aktueller Aufgabe, Hinweise bei Überschneidungen, Rückgängig |
| **Wecker** | Automatisch aus der Aufgabe „Aufstehen“ je Wochentag, eigene Zeiten pro Wochentag, einmalige Änderung oder Ausschalten für einzelne Tage, Weckton (3 eigene Töne + System), Schlummern, Anzeige des nächsten Weckers, Testwecker. Echte Wecker über **AlarmKit (iOS 26+)** bzw. **AlarmManager.setAlarmClock (Android)**, sonst Ersatz über Mitteilungen mit Hinweis |
| **Standort** | Zuhause/Schule/weitere Orte, Geofencing (Ankunft/Verlassen), Aufgaben mit Ortsauslöser, „Willkommen zu Hause!“-Mitteilung, automatische Planverschiebung bei später Ankunft, manueller Knopf „Ich bin zu Hause“ als Alternative |
| **Timer** | Pro Aufgabe, Start/Pause/Fortsetzen/Vorzeitig beenden/Erledigt, Verlängern um 5/10/15/30/eigene Minuten, Rückfrage zum Verschieben der Folgeaufgaben, Mitteilung bei Ablauf mit „Abschließen“ und „+10 Minuten“, läuft über Zeitstempel korrekt weiter, wenn die App geschlossen ist |
| **Planung** | Überschneidungen erkennen, freie Lücken („Pausen“) puffern Verspätungen ab, feste Termine werden nur nach Rückfrage verschoben, offene Aufgaben in den nächsten Tag übernehmen |
| **Aufgaben** | Erstellen, bearbeiten, löschen, Uhrzeit/Dauer, Wiederholung (Wochentage oder einmalig), Kategorie (10), Erinnerung mit Vorlauf und eigenem Text, Timer, fester Termin, Ortsauslöser, pausieren, nur für einen Tag verschieben |
| **Mitteilungen** | Lokale Erinnerungen mit „Erledigt“/„Später“, Nachfrage bei offenen Aufgaben, Ruhezeiten, Erinnerung pro Aufgabe abschaltbar |
| **Kalender** | Woche Mo–So als Zeitleiste, Tagesansicht, Kategorienfilter, Wecker pro Tag, Aufgaben für bestimmte Tage |
| **Statistik** | Heute, Woche (Konsistenz), Entwicklung über 6 Wochen, häufig verschobene Aufgaben, durchschnittliche Aufgabenzeit, erledigt nach Kategorie – ohne Leistungsdruck (Tage ohne Nutzung zählen nicht als 0 %) |
| **Tagesrückblick** | Erledigt / verschoben / ausgelassen / offen, Prozent, „Morgen vorbereiten“ mit Weckzeit für morgen und Vorschau |
| **Design** | Hell/Dunkel/System, native Tabs (Liquid Glass ab iOS 26), SF Symbols / Material Symbols, ruhige grüne Akzentfarbe |

## Benutzen: Web-App auf dem iPhone

**Adresse:** https://hernandezgranadosmatias3-ai.github.io/jetzt/

1. Die Adresse auf dem iPhone in **Safari** öffnen.
2. Unten auf **Teilen** (Quadrat mit Pfeil) tippen → **„Zum Home-Bildschirm“** → Hinzufügen.
3. Jetzt über das neue Symbol auf dem Home-Bildschirm starten (nicht mehr über Safari) und die
   Einrichtung durchgehen.

Die App läuft dann im Vollbild wie eine normale App, auch offline. Deine Aufgaben und
Statistiken werden **nur auf deinem iPhone** gespeichert (im Speicher dieser Home-Bildschirm-App).

**Was die Web-Version kann und was nicht**

| Funktioniert | Geht im Browser nicht |
| --- | --- |
| Tagesplan, „Jetzt an der Reihe“, Fortschritt | Echter Wecker → Zeiten einmal in der **Uhr-App** stellen (die Wecker-Seite zeigt sie) |
| Timer mit Pause/Verlängern, Plan rückt nach | Erinnerungen bei gesperrtem iPhone → Ton + Hinweis nur, **solange Jetzt geöffnet ist** |
| „Ich bin zu Hause“ mit automatischer Planverschiebung | Automatische Zuhause-Erkennung (Geofencing) |
| Kalender, Statistik, Tagesrückblick, Aufgaben bearbeiten | |

**Updates:** Jede Änderung, die in das GitHub-Repo
[hernandezgranadosmatias3-ai/jetzt](https://github.com/hernandezgranadosmatias3-ai/jetzt)
geschoben wird, baut GitHub automatisch neu (`.github/workflows/pages.yml`, ca. 2–3 Minuten).
Die App holt sich die neue Version beim nächsten Öffnen.

**Achtung beim Löschen:** Entfernst du das Symbol vom Home-Bildschirm, sind auch die Daten weg.

## Native App (optional)

Die folgenden Abschnitte betreffen die native iOS-/Android-Version mit echtem Wecker und
Geofencing. Für die Web-App braucht man sie nicht.

### Auf dein iPhone (ohne App Store)

Die App wird auf deinem Mac gebaut und per Kabel auf dein iPhone gespielt. Danach läuft sie
eigenständig – der Mac muss nicht an sein.

**Einmalig vorbereiten (ca. 5 Minuten):**

1. **Xcode → Einstellungen → Accounts → „+“ → Apple-ID** und mit deiner normalen Apple-ID
   anmelden. Kostenlos, keine Mitgliedschaft nötig.
2. **iPhone per Kabel** mit dem Mac verbinden, entsperren und „Diesem Computer vertrauen“ tippen.
3. Auf dem iPhone **Einstellungen → Datenschutz & Sicherheit → Entwicklermodus** einschalten
   (das iPhone startet neu). Der Punkt erscheint erst, nachdem das iPhone einmal mit Xcode
   verbunden war.

**Installieren** (im Ordner `jetzt`):

```bash
npm run iphone
```

Beim ersten Mal danach auf dem iPhone: **Einstellungen → Allgemein → VPN und
Geräteverwaltung → deine Apple-ID → Vertrauen**. Dann „Jetzt“ öffnen und die Einrichtung
durchgehen (Mitteilungen, Wecker und Standort „Immer“ erlauben).

**Gut zu wissen**

- Mit kostenloser Apple-ID läuft die Installation **7 Tage**. Danach startet die App nicht mehr,
  bis du wieder `npm run iphone` ausführst. Deine Daten bleiben dabei erhalten. Tipp: in Jetzt eine
  Aufgabe „App verlängern“ für jeden Sonntag anlegen.
- Mit dem **Apple Developer Program (99 €/Jahr)** hält die Installation ein Jahr – gleicher
  Befehl, nur mit dem bezahlten Konto angemeldet.
- Echte Wecker (AlarmKit) brauchen **iOS 26 oder neuer**. Auf älteren iPhones weckt dich die App
  mit Mitteilungen – dann das iPhone nachts nicht stumm schalten.

## Für Entwicklung

Voraussetzungen: Node 20+, Xcode 26+, CocoaPods (`brew install cocoapods`).

```bash
npm install
```

```bash
npx expo run:ios
```

Expo Go reicht **nicht**: Das Wecker-Modul ist nativer Code und braucht einen Development Build.
Danach genügt für JavaScript-Änderungen `npx expo start`. Android (`npx expo run:android`) braucht
Android Studio mit SDK und wurde noch nie gebaut.

### iCloud Drive

Das Projekt liegt in iCloud Drive. Große, erzeugte Ordner dürfen nicht synchronisiert werden –
sonst lagert iCloud Dateien aus („dataless“) und Build, Tests und Metro brechen mit seltsamen
Fehlern ab.

- `node_modules` ist ein normaler Ordner mit dem Attribut `com.apple.fileprovider.ignore#P`,
  das iCloud anweist, ihn zu ignorieren. Wird er gelöscht, so neu anlegen:

```bash
mkdir node_modules && xattr -w 'com.apple.fileprovider.ignore#P' 1 node_modules && npm install
```

- `ios` ist ein Symlink auf `ios.nosync` (iCloud ignoriert Namen mit `.nosync`). Nach
  `npx expo prebuild --clean` wieder so verschieben:

```bash
rm -rf ios.nosync && mv ios ios.nosync && ln -s ios.nosync ios
```

## Befehle

```bash
npm test            # Unit-Tests der Planungslogik (TZ=Europe/Berlin, inkl. Sommerzeit)
npm run typecheck   # TypeScript
npx eslint src      # Lint
```

## Architektur

```
index.ts                 Einstieg: definiert Hintergrund-Tasks vor dem Rendern
src/domain/              Reine Logik ohne React Native (getestet)
  types.ts               Datenmodell (Aufgabe, Tagesprotokoll, Wecker, Orte …)
  plan.ts                Tagesplan, „Jetzt“-Aufgabe, Fortschritt, Überschneidungen
  schedule.ts            Starten, Timer, Verlängern, Kaskade, Ankunft, Rückgängig
  alarms.ts              Weckzeiten → Wecker-Specs (wöchentlich / einmalig)
  reminders.ts           Rollendes Fenster lokaler Erinnerungen, Ruhezeiten
  stats.ts               Statistiken
src/data/                SQLite (expo-sqlite) + zustand-Store + Aktionen
src/services/            Betriebssystem: Mitteilungen, Wecker, Geofencing, Sync, Hintergrund
src/app/                 Bildschirme (expo-router, native Tabs)
src/ui/                  UI-Kit, Theme, Zeitleiste
modules/jetzt-alarm/     Natives Wecker-Modul (Swift/AlarmKit, Kotlin/AlarmManager)
```

**Zeiten** werden als Wanduhr-Minuten (0–1439) gespeichert und erst beim Planen beim System in
Zeitstempel umgerechnet. Dadurch bleiben 06:20 auch nach Sommerzeit- oder Zeitzonenwechsel 06:20.

**Sync** (`services/sync.ts`): Nach jeder Änderung, beim Start, beim Zurückkehren in die App und im
periodischen Hintergrund-Task werden Erinnerungen, Timer-Mitteilung, Wecker und Geofences mit dem
Plan abgeglichen.

### Drei Arten von Meldungen

1. **Echte Wecker** (natives Modul): klingeln wie die Uhr-App, auch im Stumm-Modus/Fokus, überleben
   App-Beenden und Neustart.
2. **Lokale Mitteilungen** (expo-notifications): Erinnerungen, Timer-Ende, Ankunft, Wecker-Ersatz.
   Werden auf dem Gerät geplant, funktionieren offline. iOS erlaubt höchstens 64 geplante
   Mitteilungen – die App plant deshalb ein rollendes Fenster von 3 Tagen (max. 40).
3. **Push-Nachrichten** (Server → APNs/FCM): werden nicht verwendet. Sie wären erst für eine
   Cloud-Synchronisierung zwischen Geräten nötig.

## Plattform-Grenzen (ehrlich)

**Wecker – iOS**
- AlarmKit gibt es ab iOS 26. Auf älteren Versionen nutzt die App wiederholte
  Mitteilungen (3 Stück im Abstand von 3 Minuten). Diese klingeln **nicht** im Stumm-Modus; die
  App zeigt das in den Wecker-Einstellungen an.
- Ein wöchentlicher AlarmKit-Wecker kann einen einzelnen Tag nicht überspringen. Für Wochentage mit
  Ausnahme plant die App die nächsten 4 Wochen als Einzelwecker und stellt den wöchentlichen Wecker
  wieder her, sobald die App das nächste Mal läuft (Start oder Hintergrund-Aktualisierung).
- Eigene Wecktöne müssen in der App enthalten sein (`assets/sounds`).

**Wecker – Android**
- Die App nutzt `USE_EXACT_ALARM` (Android 13+). Google Play erlaubt das nur für Apps, deren
  Kernfunktion ein Wecker ist. Lehnt Play das ab, `USE_EXACT_ALARM` entfernen: Dann fragt die App
  über die Einstellungen nach „Wecker und Erinnerungen“ (`SCHEDULE_EXACT_ALARM`).
- Ab Android 14 kann der Nutzer den Vollbild-Wecker verbieten; dann klingelt er als dauerhafte
  Mitteilung mit Wecker-Lautstärke. Die App weist darauf hin.
- Manche Hersteller (Xiaomi, Huawei, Samsung mit aggressivem Energiesparen) beenden Apps
  zusätzlich – `setAlarmClock` ist davon am wenigsten betroffen.

**Standort**
- Geofencing meldet Ankunft/Abfahrt typischerweise innerhalb weniger Minuten, nicht sekundengenau.
  Radius ≥ 150 m empfohlen; beide Systeme begrenzen die Zahl der Regionen (iOS 20, Android 100).
- Ohne Zugriff „Immer“ kann das System die App nicht wecken. Dann gibt es den Knopf
  „Ich bin zu Hause“ und zur geplanten Zeit eine normale Erinnerung.
- iOS benötigt für Geofencing keinen Hintergrundmodus „location“; die App fordert ihn nicht an.

**Mitteilungs-Aktionen**
- Android verarbeitet „Erledigt“ / „+10 Minuten“ im Hintergrund, ohne die App zu öffnen.
- iOS öffnet für diese Aktionen kurz die App, weil JavaScript nach dem Beenden der App nicht
  zuverlässig im Hintergrund startet. Das Ergebnis ist dasselbe.

**Timer**
- Der Countdown basiert auf Zeitstempeln und läuft deshalb nach Schließen/Sperren korrekt weiter.
  Ein Live-Countdown auf dem Sperrbildschirm (Live Activity / laufende Android-Mitteilung) ist noch
  nicht umgesetzt – siehe nächste Schritte.

## Phasen

- **Phase 1 – Grundversion** ✅ Design, Tagesübersicht, Aufgaben erstellen/bearbeiten/abhaken,
  lokale Mitteilungen, automatischer Wecker.
- **Phase 2 – Intelligente Funktionen** ✅ Standorterkennung, Ankunft zu Hause, Aufgaben-Timer,
  Verlängerung, automatische Anpassung des Tagesplans.
- **Phase 3 – Erweiterungen** ✅ Wochenkalender, Statistiken, Tagesrückblick.
  ⏳ Cloud-Synchronisierung (bewusst noch nicht: alles bleibt lokal; Vorschlag unten).

### Nächste Schritte

1. **Live Activity / laufende Mitteilung** für den Timer (Widget-Extension, z. B. mit
   `@bacons/apple-targets`) – damit wird auch der Schlummer-Countdown von AlarmKit sichtbar.
2. **Cloud-Sync** optional: Ende-zu-Ende-verschlüsselt (z. B. Supabase mit anonymem Konto), Routine
   als ein Dokument, Tagesprotokolle als Zeilen mit `updated_at` (letzte Änderung gewinnt).
3. **Widgets** („Jetzt“-Aufgabe auf dem Homescreen).

## Stand der Prüfung (17.11.2026)

- 23 Unit-Tests der Planungslogik grün (Tagesplan, Timer mit Pausen, Verlängern mit Kaskade,
  verspätete Ankunft, Wecker-Ausnahmen, Ruhezeiten, Sommerzeit). TypeScript, ESLint und
  `expo-doctor` (20/20) ohne Befund.
- iOS-Build mit Xcode 27.2 erfolgreich, inklusive des AlarmKit-Moduls.
- Im iOS-27-Simulator durchgeklickt: Einrichtung, Heute-Seite, Verlängern mit Rückfrage und
  fester Schlafenszeit, Rückgängig, Aufgaben-Editor, Kalender (Tag/Woche), Tagesrückblick,
  Statistik, Einstellungen, Timer (Start, Countdown, Pause), manuelle Ankunft „Ich bin zu Hause“,
  eine echte lokale Mitteilung („Noch offen: …“).
- **Im Simulator nicht prüfbar:** AlarmKit verweigert dort die Erlaubnis (der Systemdienst hat im
  Simulator nicht die nötige Berechtigung), Geofencing meldet „nicht verfügbar“. Die App fällt in
  beiden Fällen korrekt auf Mitteilungen bzw. den Ankunfts-Knopf zurück und zeigt das an.
  Echte Wecker und Geofencing müssen auf einem iPhone geprüft werden.
- **Android** wurde nicht gebaut (auf diesem Mac fehlt das Android SDK). Der Kotlin-Code des
  Wecker-Moduls ist geschrieben, aber unkompiliert.

## Test-Checkliste für echte Geräte

Im Simulator lassen sich Wecker im Stumm-Modus, Geofencing im Hintergrund und Neustarts nicht
verlässlich prüfen. Auf jedem Gerät (iPhone mit iOS 26+, ein älteres iPhone, ein Android 14+, ein
Android 12):

- [ ] Einrichtung durchlaufen, alle Berechtigungen erteilen
- [ ] Wecker → „Testwecker stellen“, App schließen, Telefon sperren und **stumm** schalten → klingelt
- [ ] Schlummern und Stopp funktionieren; Android: Vollbild über dem Sperrbildschirm
- [ ] Telefon neu starten → nächster Wecker steht noch (Einstellungen → Wecker)
- [ ] Für morgen „Ausschalten“ → morgen kein Wecker, übermorgen wieder
- [ ] Aufgabe mit Timer starten, App schließen, 2 Min warten → Countdown stimmt
- [ ] Timer ablaufen lassen → Mitteilung, „+10 Minuten“ → Plan verschoben
- [ ] Zuhause anlegen, weggehen (> 300 m), zurückkommen → „Willkommen zu Hause!“
- [ ] Standortzugriff entziehen → Knopf „Ich bin zu Hause“ funktioniert
- [ ] Ruhezeit 22:15–06:00 → keine Erinnerungen in der Nacht
- [ ] Zeitzone wechseln (Einstellungen → Allgemein → Datum & Uhrzeit) → Wecker bleibt 06:20 Ortszeit
- [ ] Dunkelmodus und große Schrift (Dynamic Type) prüfen
