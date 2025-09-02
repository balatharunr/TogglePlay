# TogglePlay Extension

A Microsoft Edge extension that automatically toggles play/pause between YouTube tabs for seamless media experience.

## Features

- **YouTube-to-YouTube Synchronization**: When one YouTube tab plays, paired tabs automatically pause
- **Bidirectional Control**: Either tab can control the other
- **Single Pair Mode**: Only one active pair at a time for simplicity
- **Persistent Settings**: Pairs and settings are saved across browser sessions
- **Smart Detection**: Automatically detects YouTube video elements and state changes
- **Robust Error Handling**: Handles tab refreshes, navigation, and connection issues

## How It Works

1. **Primary Tab**: The currently active/selected tab
2. **Secondary Tab**: Choose from available YouTube tabs
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

### Missing Icons:
Create these icon files in the `icons/` folder:
- `icon16.png` (16x16px)
- `icon32.png` (32x32px) 
- `icon48.png` (48x48px)
- `icon128.png` (128x128px)

## Usage

1. **Open YouTube tabs**: Open multiple YouTube videos in different tabs
2. **Click extension icon**: Click the TogglePlay icon in the toolbar
3. **Enable extension**: Make sure the toggle is "ON"
4. **Select secondary tab**: Choose a YouTube tab from the "Secondary" list
5. **Start watching**: Play/pause in either tab to see automatic synchronization

## File Structure

```
TogglePlay/
├── manifest.json           # Extension configuration
├── background.js           # Service worker for tab communication
├── content_youtube.js      # YouTube page integration
├── popup.html             # Extension popup interface
├── popup.css              # Popup styling
├── popup.js               # Popup functionality
├── icons/                 # Extension icons (create these)
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
└── README.md              # This file
```

## Technical Details

### Architecture:
- **Content Script**: Detects video state changes on YouTube pages
- **Background Service Worker**: Manages communication between tabs
- **Popup Interface**: User controls for pairing and settings
- **Storage**: Persists pairs and settings using Chrome storage API

### Key Features:
- Debounced state change detection (300ms)
- Retry logic for failed communications
- Automatic cleanup of invalid pairs
- Support for YouTube's SPA navigation
- Cross-tab synchronization with 1:1 pairing

### Error Handling:
- Connection failure recovery
- Tab validity checking
- Extension context invalidation handling
- Graceful degradation when tabs are closed/refreshed

## Troubleshooting

### Common Issues:

1. **Extension not working**: 
   - Check that you're on YouTube video pages
   - Refresh YouTube tabs after installing
   - Check browser console for errors

2. **Tabs not syncing**:
   - Ensure both tabs have videos loaded
   - Check that extension is enabled
   - Try removing and re-adding the pair

3. **Missing tabs in selection**:
   - Make sure tabs are actual YouTube video pages (/watch, /shorts)
   - Refresh the extension popup
   - Check that tabs are not private/incognito

### Debug Mode:
Open browser console (F12) to see detailed logs:
- Content script logs: `[TogglePlay Content-{tabId}]`
- Background script logs: `[TogglePlay Background]`
- Popup script logs: `[TogglePlay Popup]`

## Development

The extension follows the prompts and specifications in `prompt.md` and is specifically designed for Microsoft Edge add-ons with:

- Manifest V3 compatibility
- Service worker background script
- Chrome extension APIs
- Robust error handling and retry logic
- Modern ES6+ JavaScript

## License

This extension is developed for educational and personal use.
