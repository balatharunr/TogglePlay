# TogglePlay Extension

A Microsoft Edge extension that automatically switches between playing videos/songs on different tabs. When you pause a video or song in one tab, it automatically starts playing in the paired tab.

## Features

- **Bidirectional Auto-Toggle**: When you pause media in one tab, the paired tab automatically starts playing, and vice versa
- **Automatic Current Tab Detection**: Current tab is automatically selected as Tab 1
- **Smart Tab Selection**: Shows a list of all available YouTube/Spotify tabs to choose from
- **Support for YouTube and Spotify**: Works with YouTube videos and Spotify music
- **Easy Tab Pairing**: Simple one-click interface to pair tabs
- **Auto-Enable**: Toggle functionality is automatically enabled when a pair is created
- **Visual Feedback**: Clear indication of paired tabs and their status

## Installation

1. Download or clone this extension folder
2. Open Microsoft Edge
3. Navigate to `edge://extensions/`
4. Enable "Developer mode" in the bottom left
5. Click "Load unpacked" and select the TogglePlay folder
6. The extension will be installed and ready to use

## How to Use

1. **Open Media Tabs**: Open YouTube videos or Spotify music in separate tabs

2. **Create Toggle Pair**: 
   - Go to any YouTube or Spotify tab
   - Click the TogglePlay icon in your browser toolbar
   - The current tab will be automatically selected as Tab 1
   - Choose another tab from the "Choose Second Tab" list
   - The toggle pair will be created and enabled automatically!

3. **Bidirectional Auto-Toggle**: Now the tabs work together seamlessly:
   - **Play** in Tab A → Tab B **automatically pauses**
   - **Pause** in Tab A → Tab B **automatically starts playing**
   - **Play** in Tab B → Tab A **automatically pauses**  
   - **Pause** in Tab B → Tab A **automatically starts playing**

## Quick Example

1. Open a YouTube video in Tab A
2. Open Spotify (open.spotify.com) in Tab B  
3. Go to Tab A, click TogglePlay icon, select Tab B from the list
4. Test the bidirectional toggle:
   - **Play** video in Tab A → Tab B (Spotify) **automatically pauses**
   - **Pause** video in Tab A → Tab B (Spotify) **automatically starts playing!**
   - **Play** music in Tab B → Tab A (YouTube) **automatically pauses**
   - **Pause** music in Tab B → Tab A (YouTube) **automatically resumes!**

## Supported Platforms

- **YouTube**: All YouTube videos (youtube.com, youtu.be)
- **Spotify**: Spotify Web Player (open.spotify.com)

## Permissions Required

- `tabs`: To access tab information
- `activeTab`: To interact with the currently active tab
- `storage`: To save toggle pair configurations
- `scripting`: To inject content scripts

## Files Structure

```
TogglePlay/
├── manifest.json          # Extension configuration
├── background.js          # Background service worker
├── content_youtube.js     # YouTube content script
├── content_spotify.js     # Spotify content script
├── popup.html            # Extension popup interface
├── popup.css             # Popup styling
├── popup.js              # Popup functionality
├── icon16.png            # 16x16 icon
├── icon48.png            # 48x48 icon
├── icon128.png           # 128x128 icon
└── README.md             # This file
```

## Technical Details

The extension uses:
- **Manifest V3**: Latest extension standard
- **Content Scripts**: Injected into YouTube and Spotify pages to monitor media state
- **Background Service Worker**: Manages communication between tabs
- **Chrome Storage API**: Persists toggle pair configurations
- **Chrome Tabs API**: Manages tab interactions

## Troubleshooting

**Extension not working?**
- Make sure you're on a supported site (YouTube or Spotify)
- Check that the extension is enabled in edge://extensions/
- Try refreshing the media tabs after installing the extension

**Auto-toggle not working?**
- Ensure "Enable Auto-Toggle" is turned on
- Check that both tabs are properly paired
- Make sure both tabs are still open and haven't been refreshed

**Can't select tabs?**
- Only YouTube and Spotify tabs can be selected
- Make sure you're on the correct tab when clicking "Select Current Tab"

## Version History

- **v1.0.0**: Initial release with YouTube and Spotify support

## Privacy

This extension:
- Only accesses YouTube and Spotify websites
- Stores toggle pair data locally in your browser
- Does not collect or transmit any personal data
- Does not track your browsing activity

## Support

For issues or feature requests, please check the troubleshooting section above or contact the developer.
