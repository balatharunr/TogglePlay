# Changelog

All notable changes to TogglePlay are documented here.

## [2.0.0] — 2026-05-22

### Added
- Persistent settings via `chrome.storage.local` (enabled state, “One audio at a time” preference)
- Session-based tab pairing via `chrome.storage.session` (survives popup close; cleared when the browser session ends)
- Settings panel in the popup with optional **One audio at a time** — keeps only one media tab playing in the browser when you start playback
- Spotify web player detection improvements and clearer handling when playback is on another device
- Auto-injection of content scripts after extension install/update (fewer “refresh the tab” steps)

### Changed
- Default pairing behavior is **mirror sync**: pause one tab → play the partner; play one → pause the partner
- Popup UI rebuilt with stable in-place updates (reduced flicker)
- Background service worker architecture with hydration, tab lifecycle cleanup, and echo suppression for controlled tabs
- Privacy policy updated for v2 storage and permissions

### Fixed
- Spotify sync failing with false `DEVICE_NOT_WEB` when the web player was active
- Popup showing raw SVG markup instead of platform icons
- Excessive popup refresh from YouTube title updates
- Pairing no longer blocked when “One audio at a time” is enabled

## [1.2.1] — earlier

- Initial Manifest V3 release with YouTube, YouTube Music, and Spotify DOM-based sync
- Single-pair mode and keyboard shortcut to pause both tabs
