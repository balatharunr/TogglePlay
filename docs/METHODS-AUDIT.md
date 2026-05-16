# TogglePlay — Methods & Architecture Audit

**Version audited:** 1.2.1 (Manifest V3)  
**Date:** 2026-05-16  
**Scope:** All detection, control, communication, and UI methods across `src/background/`, `src/content/<platform>/`, `src/content/shared/`, and `src/popup/`.

---

## Table of contents

1. [Executive summary](#executive-summary)
2. [Architecture](#architecture)
3. [Chrome Extension APIs in use](#chrome-extension-apis-in-use)
4. [Inter-script messaging protocol](#inter-script-messaging-protocol)
5. [Platform-specific methods](#platform-specific-methods)
6. [Cross-cutting patterns](#cross-cutting-patterns)
7. [What is lacking](#what-is-lacking)
8. [Research & improvement backlog](#research--improvement-backlog)
9. [Decision matrix (quick reference)](#decision-matrix-quick-reference)

---

## Executive summary

TogglePlay is a **Manifest V3** browser extension that pairs two media tabs (YouTube, YouTube Music, Spotify) and keeps them in a **bidirectional play/pause mirror**:

| User action on Tab A | Extension does on Tab B |
|----------------------|-------------------------|
| Starts playing       | Pauses                  |
| Pauses               | Plays (if paired)       |

**How it works today:** Content scripts observe playback on each site, notify the background service worker, which sends `CONTROL_PLAYBACK` to the paired tab. Control is implemented via **HTML5 `<video>` APIs** (YouTube / YT Music) or **DOM button clicks + aria-label/SVG heuristics** (Spotify).

**What it does *not* use:** Media Session API, `chrome.storage`, official Spotify/YouTube APIs, `scripting.executeScript`, keyboard event synthesis (despite an outdated comment in Spotify script), or any native messaging.

---

## Architecture

```
┌─────────────┐     chrome.runtime.sendMessage       ┌──────────────────┐
│ src/popup/  │ ◄──────────────────────────────────► │ src/background/  │
└─────────────┘                                      │  (service worker)│
                                                     └────────┬─────────┘
                                                              │
                              chrome.tabs.sendMessage         │
                    ┌─────────────────────────────────────────┼─────────────────────────┐
                    ▼                                         ▼                         ▼
            ┌──────────────┐                        ┌──────────────────┐        ┌──────────────────┐
            │youtube/index │                        │ ytmusic/index    │        │ spotify/index    │
            │  (YouTube)   │                        │ (music.youtube)  │        │ (open.spotify)   │
            └──────────────┘                        └──────────────────┘        └──────────────────┘
```

| Layer | File | Role |
|-------|------|------|
| UI | `src/popup/popup.html`, `popup.css`, `popup.js` | Pair tabs, enable/disable, list media tabs |
| Coordinator | `src/background/*.js` | Pairs map, toggle logic, tab discovery, loop guard |
| Site adapters | `src/content/<platform>/index.js` | Detect state, execute play/pause per platform |
| Shared | `src/shared/`, `src/content/shared/` | Platform URLs, config, content messaging |

**Permissions (`manifest.json`):** `tabs` only (+ host permissions for the three domains). No `storage`, `scripting`, or `activeTab`.

---

## Chrome Extension APIs in use

| API | Where | Purpose |
|-----|-------|---------|
| `chrome.runtime.sendMessage` | All scripts | Popup ↔ background; content ↔ background |
| `chrome.runtime.onMessage` | Background + all content scripts | Message routing |
| `chrome.tabs.sendMessage` | `background.js` | Push `CONTROL_PLAYBACK` to paired tab |
| `chrome.tabs.query` | `background.js`, `popup.js` | List YouTube / YT Music / Spotify tabs; get active tab |
| `chrome.tabs.get` | `background.js` | Validate tab exists before messaging / pairing |
| `chrome.runtime.id` | Content scripts | `isContextValid()` after extension reload |

### APIs defined but **not** wired up

| API / constant | Location | Status |
|----------------|----------|--------|
| `chrome.storage` | `CONFIG.STORAGE_KEYS` in `background.js` | **Dead code** — pairs and `isEnabled` live only in memory |
| `chrome.scripting` | — | Not used |
| `chrome.commands` | — | No manifest `commands`; shortcut is custom `keydown` in content scripts |

---

## Inter-script messaging protocol

### Content → Background

| Message type | Payload | Handler behavior |
|--------------|---------|------------------|
| `GET_TAB_ID` | — | Returns `sender.tab.id` |
| `PLAYBACK_STATE_CHANGED` | `isPlaying: boolean` | Runs `handlePlaybackStateChange` (toggle paired tab) |
| `PAUSE_BOTH` | — | Disables toggle briefly; pauses paired tab; used by **B** key |

### Popup → Background

| Message type | Payload | Purpose |
|--------------|---------|---------|
| `GET_TABS` | — | Returns all discoverable media tabs |
| `GET_PAIRS` | — | Returns in-memory pairs + `isEnabled` |
| `ADD_PAIR` | `tabId1`, `tabId2` | Clears all pairs, creates one bidirectional pair |
| `REMOVE_PAIR` | `tabId1`, `tabId2` | Deletes both entries from `state.pairs` |
| `CLEAR_ALL_PAIRS` | — | Clears `state.pairs` |
| `SET_ENABLED` | `enabled: boolean` | Toggles global sync |
| `PING` | — | Health check |

### Background → Content

| Message type | Payload | Purpose |
|--------------|---------|---------|
| `CONTROL_PLAYBACK` | `action: 'PLAY' \| 'PAUSE'` | Remote play/pause |
| `GET_PLAYBACK_STATE` | — | YouTube + Spotify only |
| `GET_STATE` | — | YT Music only (inconsistent name) |
| `PING` | — | Health check |

### Response contract

- Most handlers return `{ success: true }` or `{ success: false, error: string }`.
- Content listeners use `return true` + async `sendResponse` (YouTube) or synchronous `sendResponse` (YT Music, Spotify).

---

## Platform-specific methods

### YouTube (`content.js`)

#### Playback detection

| Method | Implementation |
|--------|----------------|
| Find media element | `document.querySelector('video')` |
| Valid video check | `readyState >= 1` && `duration > 0` |
| Playing heuristic | `!paused && !ended && currentTime > 0` |
| Event listeners | `play`, `pause`, `ended` on `<video>` |
| Polling fallback | `setInterval(checkForVideo, 2000)` — re-attach when video element changes (SPA navigation) |
| Debounce | 300 ms before `PLAYBACK_STATE_CHANGED` |

#### Playback control

| Method | Implementation |
|--------|----------------|
| Play | `await video.play()` |
| Pause | `video.pause()` |

#### Extras

| Feature | Method |
|---------|--------|
| Pause both | **B** key → `video.pause()` locally + `PAUSE_BOTH` to background |
| Listener dedup | Per-video flag `togglePlayListenersSet_${SESSION_ID}` |

#### Tab discovery (`background.js` vs `popup.js`)

| Location | Filter |
|----------|--------|
| `getYouTubeTabs()` | URL contains **`/watch?` only** |
| `popup.js` `isYouTubeUrl()` | `/watch`, `/shorts/`, `/embed/`, `youtu.be/` |

**Gap:** Shorts, embeds, and youtu.be tabs can appear in the popup but are **not** returned by `GET_TABS` from the background.

---

### YouTube Music (`content-ytmusic.js`)

#### Playback detection

| Method | Implementation |
|--------|----------------|
| Find media | Same as YouTube: `document.querySelector('video')` + readiness checks |
| Playing heuristic | Same: `!paused && !ended && currentTime > 0` |
| Event listeners | Named handlers: `handlePlay`, `handlePause`, `handleEnded` |
| DOM watch | `MutationObserver` on `document.body` (childList, subtree) |
| Polling | `setInterval` every 2 s as backup |
| Debounce | **150 ms** (faster than YouTube) |

#### Playback control (layered)

| Priority | Method |
|----------|--------|
| 1 | `video.play()` / `video.pause()` |
| 2 | On `play()` rejection → `clickPlayPauseButton()` |
| 3 | No video → button click only |

#### Button fallback selectors

```text
#play-pause-button
tp-yt-paper-icon-button#play-pause-button
.ytmusic-player-bar #play-pause-button
[aria-label="Play"]
[aria-label="Pause"]
```

#### Message naming inconsistency

- State query: `GET_STATE` (not `GET_PLAYBACK_STATE`).
- No **B** key / `PAUSE_BOTH` handler (unlike YouTube and Spotify).

---

### Spotify (`content-spotify.js`)

#### Playback detection

| Method | Implementation |
|--------|----------------|
| Find control | `querySelector` over `data-testid` and `aria-label` selectors |
| Playing state | `aria-label` contains `"pause"` → playing; `"play"` → paused |
| SVG fallback | Count `rect` (pause icon) vs `polygon` (play icon) inside button SVG |
| DOM watch | `MutationObserver` on now-playing bar (`aria-label`, `class`) |
| Polling | Every **500 ms** |
| Player ready gate | Poll up to 60 s for button before attaching observer |
| Debounce | 300 ms |

#### Playback control

| Method | Implementation |
|--------|----------------|
| Play / Pause | `button.click()` **only if** current state differs from requested action |
| Direct audio/video API | **Not available** (DRM / EME — noted in file header) |

#### Documented vs actual behavior

| Documented in header/README | Actual code |
|-----------------------------|-------------|
| “keyboard simulation (spacebar)” | **Not implemented** — uses `button.click()` |
| Web player must be active device | `isWebPlayerActive()` exists but is **never called** |

#### Extras

| Feature | Method |
|---------|--------|
| Pause both | **B** key → local `controlPlayback('PAUSE')` + `PAUSE_BOTH` |

#### Spotify selectors in use

```text
button[data-testid="control-button-playpause"]
[data-testid="control-button-playpause"]
button[aria-label="Pause|Play"]
.player-controls button[aria-label="Pause|Play"]
[data-testid="device-picker-button"]        (device check — unused)
[data-testid="now-playing-bar|now-playing-widget"]
.now-playing-bar
```

---

### Background toggle logic (`background.js`)

| Mechanism | Details |
|-----------|---------|
| Pair storage | `Map<tabId, { pairedWith, title, url, sourceType }>` — **in RAM only** |
| Single pair mode | `addPair` calls `state.pairs.clear()` before adding |
| Loop prevention | `controlledTabs` Set + 1000 ms timeout after programmatic control |
| Bidirectional rule | Play on A → pause B; pause on A → play B |
| `PAUSE_BOTH` | Temporarily sets `isEnabled = false` for 500 ms while pausing partner |

---

### Popup (`popup.js`)

| Method | Purpose |
|--------|---------|
| `chrome.tabs.query({ active: true, currentWindow: true })` | Primary tab = current tab |
| `GET_TABS` / `GET_PAIRS` | Populate UI |
| URL helpers | `isYouTubeUrl`, `isYTMusicUrl`, `isSpotifyUrl`, `getSourceType` |
| `escapeHtml` | XSS-safe rendering |
| `retryOperation` | Exponential backoff (3 tries) on init |
| `setInterval` 10 s | Auto-refresh tab list and pairs |
| Event delegation | Clicks on available tabs and remove-pair buttons |

---

## Cross-cutting patterns

### Context invalidation handling

All content scripts use:

```javascript
function isContextValid() {
  try {
    return !!(chrome.runtime && chrome.runtime.id);
  } catch (e) {
    return false;
  }
}
```

Errors containing `Extension context invalidated`, `No tab with id`, or `Receiving end does not exist` are swallowed in the background when messaging tabs.

### Debouncing

| Script | Debounce delay |
|--------|----------------|
| YouTube | 300 ms |
| YT Music | 150 ms |
| Spotify | 300 ms |

### Not used anywhere

- **Media Session API** (`navigator.mediaSession`)
- **Page Visibility API** (`document.visibilityState`)
- **AudioContext** / Web Audio
- **IndexedDB / localStorage** for persistence
- **Offscreen documents** (MV3 pattern for background media work)
- **tabCapture** / **desktopCapture**
- **Spotify Web Playback SDK** or **YouTube IFrame API**

---

## What is lacking

### Critical / functional gaps

| # | Gap | Impact |
|---|-----|--------|
| 1 | **No persistence** (`chrome.storage` keys exist but unused) | Pairs and enabled state lost on service worker sleep / browser restart |
| 2 | **YouTube tab filter mismatch** | Background only lists `/watch?`; popup allows shorts/embed/youtu.be |
| 3 | **Bidirectional “pause → play”** | Pausing Tab A always tries to play Tab B — may be unwanted (user may want both paused) |
| 4 | **Spotify device handoff** | `isWebPlayerActive()` never used; fails silently when phone/desktop is active device |
| 5 | **Fragile DOM selectors** | Spotify/YT Music break when sites change `data-testid` or shadow DOM structure |
| 6 | **No content script on navigation** | YouTube SPA may miss video until 2 s poll; no `webNavigation` listener |
| 7 | **YT Music: no PAUSE_BOTH / B key** | Inconsistent UX vs YouTube and Spotify |
| 8 | **Message type inconsistency** | `GET_STATE` vs `GET_PLAYBACK_STATE`; no shared schema |

### Reliability gaps

| # | Gap | Impact |
|---|-----|--------|
| 9 | **Race conditions** | Debounce + 1 s `controlledTabs` window may still echo under fast toggles |
| 10 | **Autoplay policy** | `video.play()` may reject without user gesture; YT Music falls back to click — YouTube does not |
| 11 | **Background throttling** | Inactive tabs may delay timers/observers (Chrome tab discarding) |
| 12 | **No tab lifecycle hooks** | Closed/refreshed tabs leave stale pair entries until manual clear |
| 13 | **Single pair only** | By design, but limits power users |

### Security / product gaps

| # | Gap | Impact |
|---|-----|--------|
| 14 | **No `storage` permission** | Can't save preferences without manifest update |
| 15 | **No options page** | Debounce, behavior mode, shortcuts not configurable |
| 16 | **Custom B shortcut** | Not in `manifest.json` `commands`; conflicts with site shortcuts |
| 17 | **Firefox / Safari** | Chrome-only APIs assumed; not tested for MV3 parity |

### Documentation gaps

| # | Issue |
|---|--------|
| 18 | README claims Spotify uses spacebar; code uses button click |
| 19 | README references `prompt.md` which is not in the repo |
| 20 | `content-spotify.js` header comment outdated |

---

## Research & improvement backlog

Use this section as a checklist for investigation. Each item includes **what to research**, **why**, and **starting points**.

---

### 1. Media Session API

**Research:** Can `navigator.mediaSession` on YouTube, YT Music, and Spotify expose `playbackState` and accept `setActionHandler` for play/pause from extensions?

**Why:** Standard, semantic API; less DOM scraping than `aria-label` heuristics.

**Questions to answer:**
- Do all three sites register a Media Session in the tab?
- Can a content script read `navigator.mediaSession.playbackState` reliably?
- Can you call handlers or only observe?
- Does it work when tab is in background?

**Starting points:**
- [MDN: Media Session API](https://developer.mozilla.org/en-US/docs/Web/API/Media_Session_API)
- DevTools → Application → Media Session (if available) while playing on each site

---

### 2. Persistence with `chrome.storage.session` vs `local`

**Research:** MV3 service workers are ephemeral. Best practice for pair state.

**Why:** Users lose pairs when the worker restarts.

**Questions:**
- `storage.session` vs `storage.local` size limits and sync across devices?
- Restore pairs on `runtime.onStartup` / first message?

**Starting points:**
- [Chrome storage.session](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/storage/session)
- Add `"storage"` permission to manifest

---

### 3. Spotify Web Playback SDK vs DOM click

**Research:** Official SDK requires Spotify Premium and OAuth.

**Why:** DOM clicks break on UI updates and fail on non-web active devices.

**Questions:**
- Is Premium + OAuth acceptable for your users?
- Can SDK run inside a content script or only dedicated page?
- Compare with **Spotify Connect Web API** (remote control of active device)

**Starting points:**
- [Spotify Web Playback SDK](https://developer.spotify.com/documentation/web-playback-sdk)
- [Spotify Web API – Player](https://developer.spotify.com/documentation/web-api/reference/start-a-users-playback)

---

### 4. YouTube IFrame / internal player APIs

**Research:** Whether `ytplayer` / `movie_player` globals or postMessage to iframe are stable for play/pause.

**Why:** `<video>` works today but may miss Shorts UI or ad states.

**Questions:**
- Shorts player structure — same `<video>`?
- Are internal APIs ToS-safe for a store listing?

**Starting points:**
- Inspect `window.ytplayer` / `#movie_player` on watch vs shorts pages
- Community extensions (grep GitHub for `youtube pause extension content script`)

---

### 5. `chrome.scripting` + `world: MAIN` injection

**Research:** Injecting a small script into page context to access site globals.

**Why:** Some players hide state inside closed shadow DOM or JS modules inaccessible from isolated content script world.

**Risks:** Store review, breakage on updates, security.

**Starting points:**
- [scripting.executeScript](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/scripting/executeScript)
- `world: "MAIN"` vs isolated world

---

### 6. Tab activation & visibility

**Research:** `document.hidden`, `visibilitychange`, `chrome.tabs.onActivated`.

**Why:** Avoid false toggles when user switches tabs or Chrome discards background tabs.

**Ideas:**
- Only sync when at least one tab in pair was recently active
- Pause-only mode when both tabs backgrounded

---

### 7. Replace “pause → play paired tab” with configurable modes

**Research:** UX patterns in dual-player apps (DJ crossfade, “focus mode”, etc.).

**Modes to prototype:**
| Mode | Behavior |
|------|----------|
| Mirror (current) | Play A → pause B; pause A → play B |
| Exclusive | Play A → pause B; pause A → **do nothing** to B |
| Follow focus | Only the focused tab drives the other |

**Why:** Current mirror mode surprises users who want both stopped.

---

### 8. Official keyboard shortcuts (`commands` in manifest)

**Research:** `manifest.json` → `"commands"` for cross-site shortcut without capture-phase `keydown`.

**Why:** B key conflicts with YouTube (“scroll to search”), Spotify search, etc.

**Starting points:**
- [chrome.commands](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/commands)

---

### 9. `webNavigation` / SPA handling for YouTube

**Research:** Re-init content script state on `history.pushState` navigations without waiting 2 s.

**Starting points:**
- `chrome.webNavigation.onHistoryStateUpdated`
- Or listen to `yt-navigate-finish` custom events (fragile)

---

### 10. Shadow DOM piercing

**Research:** `element.shadowRoot`, `chrome.dom.openOrClosedShadowRoot` (if available), or `>>>` deep selectors in `querySelector` (limited).

**Why:** YouTube Music uses Web Components (`tp-yt-paper-icon-button`).

---

### 11. Loop prevention alternatives

**Research:** Industry patterns for “echo suppression” in sync systems.

**Alternatives to `controlledTabs` + timeout:**
- Monotonic `commandId` ignored by originating chain
- “Source: programmatic” flag on synthetic events
- Leader election (one tab is source of truth)

---

### 12. Testing strategy

**Research:** Automated testing for extensions.

**Options:**
- Puppeteer / Playwright with loaded unpacked extension
- Manual test matrix (below)

**Suggested manual matrix:**

| Primary | Secondary | Actions to verify |
|---------|-----------|-------------------|
| YouTube watch | Spotify | Play/pause on each; B key; refresh mid-play |
| YT Music | YouTube | Same |
| Spotify (web active) | YT Music | Same |
| Spotify (phone active) | YouTube | Expect failure — document UX |
| YouTube Shorts | Spotify | Tab visible in popup? Sync works? |

---

### 13. Firefox / Edge / Chrome parity

**Research:** `browser.*` namespace, `storage.session` support, service worker differences.

**Why:** README targets Edge; code uses `chrome.*` (fine on Edge Chromium).

---

### 14. Autoplay and user activation

**Research:** [Autoplay policy](https://developer.chrome.com/blog/autoplay) — when `video.play()` from extension message succeeds.

**Mitigation ideas:**
- Always prefer button click for programmatic play
- Require one user gesture per tab before enabling auto-sync

---

### 15. Alternative architectures (bigger bets)

| Approach | Pros | Cons |
|----------|------|------|
| Native messaging host | Full OS media control | Install friction, not web-only |
| System media keys (global) | Works outside browser | OS-level, not per-tab |
| Single “hub” offscreen page | Centralized state | Complex, still site-specific adapters |

---

## Decision matrix (quick reference)

| Capability | YouTube | YT Music | Spotify |
|------------|---------|----------|---------|
| **Detect play state** | `<video>` events + heuristic | Same + MutationObserver | `aria-label` + SVG + MutationObserver + poll |
| **Control play/pause** | `video.play()` / `pause()` | Video API → button click fallback | `button.click()` |
| **DRM / no video** | N/A | Rare edge cases | Always DOM-only |
| **Keyboard shortcut** | B → pause both | None | B → pause both |
| **Tab listed in popup** | watch, shorts, embed, youtu.be | music.youtube.com | open.spotify.com |
| **Tab listed in background GET_TABS** | `/watch?` only | All music.youtube tabs | All open.spotify tabs |
| **Persistence** | None (RAM) | None | None |

---

## Recommended priority order

If you are deciding what to implement first after research:

1. **Fix YouTube `GET_TABS` filter** — align with popup (`/shorts/`, `youtu.be`, etc.) — low effort, high consistency.
2. **Add `chrome.storage.session`** — persist pairs + enabled flag — medium effort, high user value.
3. **Add “exclusive” sync mode** — pause does not auto-play partner — medium effort, fixes UX complaints.
4. **Unify message types** — `GET_PLAYBACK_STATE` everywhere — low effort.
5. **Spotify: call `isWebPlayerActive()` + user warning** — medium effort.
6. **Evaluate Media Session API** — may simplify detection across sites — research first.
7. **manifest `commands` for pause-both** — replace B key hack — medium effort.
8. **Spotify Web API / SDK** — only if you accept OAuth + Premium constraints — high effort.

---

## File reference (methods by file)

| File | Key functions |
|------|----------------|
| `background.js` | `sendMessageToTab`, `getYouTubeTabs`, `getYTMusicTabs`, `getSpotifyTabs`, `getAllMediaTabs`, `handlePlaybackStateChange`, `addPair` |
| `content.js` | `findVideoElement`, `getPlaybackState`, `setupVideoListeners`, `notifyStateChange`, `controlPlayback`, `checkForVideo`, `setupKeyboardShortcuts` |
| `content-ytmusic.js` | `findPlayPauseButton`, `clickPlayPauseButton`, `controlPlayback`, `watchForVideo`, `notifyPlaybackChange` |
| `content-spotify.js` | `findPlayPauseButton`, `getPlaybackState`, `isWebPlayerActive`, `controlPlayback`, `setupPlayStateObserver`, `waitForPlayer` |
| `popup.js` | `loadAvailableTabs`, `loadActivePairs`, `handleTabSelection`, `handleToggleEnable`, URL helpers |

---

*This document reflects the repository as of v1.2.1. Re-run the audit after major refactors or new platform support.*
