# TogglePlay

**v2.0.0** — A browser extension that pairs YouTube, YouTube Music, and Spotify tabs and automatically toggles play/pause between them.

Works in **Chrome**, **Edge**, and other Chromium browsers (Manifest V3).

## Features

- **YouTube, YouTube Music & Spotify** — Pair any combination of supported media tabs
- **Mirror sync (default)** — Pause one tab → the partner plays; play one → the partner pauses
- **One audio at a time** (optional, in Settings) — When you start playback on a tab, other media tabs in the browser are paused so only one plays at once. Does not change mirror pairing behavior.
- **Single pair** — One active pair at a time; selecting a new tab replaces the current pair
- **Persistent preferences** — Enable/disable and settings survive browser restarts
- **Session pairs** — Your pair survives closing the popup; tab IDs are cleared when the browser session ends
- **Keyboard shortcut** — Press **B** on a supported media page to pause both paired tabs
- **No accounts or servers** — Everything runs locally in your browser

## Quick start

1. Install the extension (load unpacked for development, or install from the store when published).
2. Open two media tabs (e.g. YouTube + Spotify).
3. Open the TogglePlay popup from the toolbar.
4. Turn **Enable** on.
5. Under **Pair With**, click **Select** on the tab you want to pair with the current tab.
6. Play or pause in either tab — the partner follows.

### Settings

Click the **gear icon** next to Enable:

- **One audio at a time** — Off by default. When on, starting playback on any media tab pauses other media tabs in the browser. Mirror pairing (pause ↔ play between your two tabs) always works.

## Supported combinations

- YouTube ↔ YouTube
- YouTube ↔ YouTube Music
- YouTube ↔ Spotify
- YouTube Music ↔ YouTube Music
- YouTube Music ↔ Spotify

## Installation (development)

1. Open `chrome://extensions/` or `edge://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select this repository folder

After updating the extension, reload it on the extensions page. Open or refresh your media tabs if sync does not start immediately.

## Packaging

```bash
chmod +x scripts/package.sh
./scripts/package.sh
```

Creates `dist/toggleplay-v2.0.0.zip` with `manifest.json` at the archive root (Chrome Web Store / sideload).

## Project structure

```
TogglePlay/
├── manifest.json
├── CHANGELOG.md
├── assets/
├── src/
│   ├── core/           # Config, messages, platform detection
│   ├── background/     # Service worker, pairing, sync, storage
│   ├── content/        # Per-site scripts (youtube, ytmusic, spotify)
│   └── ui/
│       ├── popup/
│       └── privacy/
├── scripts/package.sh
└── docs/
```

## Troubleshooting

| Issue | What to try |
|--------|-------------|
| Tabs not syncing | Enable the extension; confirm both tabs are paired; refresh both tabs after install |
| Spotify not responding | Use **This computer** in Spotify’s device menu; reload the Spotify tab |
| “Web player not active” in popup | Spotify is playing on phone/speaker — switch to this browser in Spotify |
| Pair disappeared | Browser was restarted (pairs are session-only) — pair again in the popup |
| Wrong tab listed | Only YouTube watch/shorts, music.youtube.com, and open.spotify.com are supported |

**Debug logs** (F12 → Console): `[TogglePlay Background]`, `[TogglePlay Popup]`, `[TogglePlay Content-…]`, `[TogglePlay Spotify-…]`, etc.

## Privacy

See [Privacy Policy](src/ui/privacy/privacy.html) (also linked from the popup). No data is sent to external servers; optional settings and pairs are stored locally only.

## License

For educational and personal use.
