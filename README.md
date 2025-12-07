# TogglePlay Extension

A Microsoft Edge extension that automatically toggles play/pause between YouTube, YouTube Music, and Spotify tabs for seamless media experience.

## Features

- **YouTube, YouTube Music & Spotify Support**: Works with YouTube videos, YouTube Music, and Spotify web player
- **Cross-Platform Sync**: Pair any combination of YouTube, YouTube Music, and Spotify tabs
- **Bidirectional Control**: Either tab can control the other
- **Single Pair Mode**: Only one active pair at a time for simplicity
- **Persistent Settings**: Pairs and settings are saved across browser sessions
- **Smart Detection**: Automatically detects media elements and state changes
- **Robust Error Handling**: Handles tab refreshes, navigation, and connection issues
- **Keyboard Shortcut**: Press 'B' to pause both tabs instantly

## How It Works

1. **Primary Tab**: The currently active/selected tab (YouTube, YouTube Music, or Spotify)
2. **Secondary Tab**: Choose from available YouTube, YouTube Music, or Spotify tabs
3. **Auto-Toggle**: When primary plays → secondary pauses, when primary pauses → secondary plays
4. **Single Pair**: Only one pair allowed at a time, new selections replace existing pairs

## Installation

### For Development:
1. Open Microsoft Edge
2. Go to `edge://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select the TogglePlay folder
6. The extension icon will appear in the toolbar

## Usage

1. **Open media tabs**: Open YouTube videos, YouTube Music, and/or Spotify web player in different tabs
2. **Click extension icon**: Click the TogglePlay icon in the toolbar
3. **Enable extension**: Make sure the toggle is "ON"
4. **Select secondary tab**: Choose a media tab from the "Secondary" list
5. **Start listening**: Play/pause in either tab to see automatic synchronization

### Supported Combinations:
- ▶️ YouTube ↔ ▶️ YouTube (two YouTube video tabs)
- ▶️ YouTube ↔ 🎧 YouTube Music (YouTube and YouTube Music)
- 🎧 YouTube Music ↔ 🎧 YouTube Music (two YouTube Music tabs)
- 🎧 YouTube Music ↔ 🎵 Spotify (YouTube Music and Spotify)
- ▶️ YouTube ↔ 🎵 Spotify (YouTube and Spotify)

## File Structure

```
TogglePlay/
├── manifest.json           # Extension configuration
├── background.js           # Service worker for tab communication
├── content.js              # YouTube page integration
├── content-ytmusic.js      # YouTube Music page integration
├── content-spotify.js      # Spotify web player integration
├── popup.html              # Extension popup interface
├── popup.css               # Popup styling
├── popup.js                # Popup functionality
├── icon.png                # Extension icon
├── prompt.md               # Development prompts
└── README.md               # This file
```

## Technical Details

### Architecture:
- **Content Scripts**: Detect playback state changes on YouTube, YouTube Music, and Spotify pages
- **Background Service Worker**: Manages communication between tabs
- **Popup Interface**: User controls for pairing and settings
- **Storage**: Persists pairs and settings using Chrome storage API

### Key Features:
- Debounced state change detection (300ms for YouTube, 150ms for YouTube Music)
- Retry logic for failed communications
- Automatic cleanup of invalid pairs
- Support for YouTube's SPA navigation
- YouTube Music native video element control
- Spotify web player DOM-based control
- Cross-tab synchronization with 1:1 pairing

### Error Handling:
- Connection failure recovery
- Tab validity checking
- Extension context invalidation handling
- Graceful degradation when tabs are closed/refreshed

## Troubleshooting

### Common Issues:

1. **Extension not working**: 
   - Check that you're on YouTube video pages, YouTube Music, or Spotify web player
   - Refresh tabs after installing
   - Check browser console for errors

2. **Tabs not syncing**:
   - Ensure both tabs have media loaded
   - For Spotify, make sure the web player is active (not in "Connect to a device" mode)
   - Check that extension is enabled
   - Try removing and re-adding the pair

3. **Missing tabs in selection**:
   - For YouTube: Make sure tabs are video pages (/watch, /shorts)
   - For YouTube Music: Make sure you're on music.youtube.com
   - For Spotify: Make sure you're on open.spotify.com
   - Refresh the extension popup
   - Check that tabs are not private/incognito

4. **Spotify not responding**:
   - Make sure Spotify web player is fully loaded
   - Play a song first to activate the player controls
   - Refresh the Spotify tab and try again

5. **YouTube Music not responding**:
   - Make sure a song is loaded and the player is visible
   - Refresh the YouTube Music tab and try again

### Debug Mode:
Open browser console (F12) to see detailed logs:
- YouTube content script logs: `[TogglePlay Content-{tabId}]`
- YouTube Music content script logs: `[TogglePlay YTMusic-{tabId}]`
- Spotify content script logs: `[TogglePlay Spotify-{tabId}]`
- Background script logs: `[TogglePlay Background]`
- Popup script logs: `[TogglePlay Popup]`

## Development

The extension follows the prompts and specifications in `prompt.md` and is specifically designed for Microsoft Edge add-ons with:

- Manifest V3 compatibility
- Service worker background script
- Chrome extension APIs
- Robust error handling and retry logic
- Modern ES6+ JavaScript
- No API keys required (uses DOM manipulation for both YouTube and Spotify)

## License

This extension is developed for educational and personal use.
