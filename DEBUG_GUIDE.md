# TogglePlay Debug Guide

## 🚨 Extension Not Working - Let's Debug Step by Step

### Step 1: Test with Simplified Version

1. **Rename files to test simplified version:**

```bash
# Backup current files
copy manifest.json manifest_original.json
copy background.js background_original.js  
copy content_youtube.js content_original.js

# Use debug versions
copy manifest_debug.json manifest.json
copy background_simple.js background.js
copy content_simple.js content_youtube.js
```

2. **Reload extension in Edge:**
   - Go to `edge://extensions/`
   - Find TogglePlay extension
   - Click "Reload" button

### Step 2: Basic Functionality Test

1. **Open 2 YouTube videos:**
   - Tab A: https://www.youtube.com/watch?v=dQw4w9WgXcQ
   - Tab B: https://www.youtube.com/watch?v=9bZkp7q19f0

2. **Open Browser Console (F12):**
   - Look for these log messages:
   ```
   [TogglePlay Background SIMPLE] Simple background script loaded
   [TogglePlay Content SIMPLE-{number}] Simple content script initialized
   ```

3. **Test Extension Popup:**
   - Click TogglePlay icon
   - Should see both tabs in the interface
   - Create a pair by selecting secondary tab

4. **Test Basic Toggle:**
   - Play Tab A → Should see console logs showing Tab B gets pause command
   - Pause Tab A → Should see console logs showing Tab B gets play command

### Step 3: Debug Common Issues

**Issue 1: No console logs at all**
```javascript
// Test in browser console:
chrome.runtime.sendMessage({type: 'PING'}, console.log)
```

**Issue 2: Content script not loading**
- Refresh YouTube tabs after reloading extension
- Check if you're on actual video pages (/watch?v=...)

**Issue 3: Messages not sending**
```javascript
// Test message sending:
chrome.tabs.query({url: "*://www.youtube.com/*"}, tabs => {
    console.log("YouTube tabs found:", tabs.length);
    tabs.forEach(tab => console.log(tab.id, tab.title));
});
```

### Step 4: Manual Console Testing

**In YouTube Tab A console:**
```javascript
// Test if content script loaded
console.log("Testing content script...");

// Test direct video control
const video = document.querySelector('video');
if (video) {
    console.log("Video found:", video);
    console.log("Current state:", !video.paused);
    
    // Test play/pause
    video.play().then(() => console.log("Play successful"));
    setTimeout(() => video.pause(), 2000);
} else {
    console.log("No video element found");
}
```

**In Extension Background (Service Worker Console):**
```javascript
// Check current pairs
console.log("Current pairs:", Array.from(state.pairs.entries()));

// Test message to specific tab
chrome.tabs.query({url: "*://www.youtube.com/*"}, tabs => {
    if (tabs.length > 0) {
        chrome.tabs.sendMessage(tabs[0].id, {type: 'PING'}, response => {
            console.log("Tab response:", response);
        });
    }
});
```

### Step 5: Common Fixes

**Fix 1: Extension Context Issues**
- Close all YouTube tabs
- Reload extension
- Open fresh YouTube tabs

**Fix 2: Permission Issues**
- Check manifest permissions are correct
- Try removing and re-adding extension

**Fix 3: Video Loading Issues**
- Wait for videos to fully load (not just page load)
- Test with simple, short videos first
- Avoid live streams or premieres

### Step 6: Restore Original Files

Once working, restore the full version:
```bash
copy manifest_original.json manifest.json
copy background_original.js background.js
copy content_original.js content_youtube.js
```

## 🔍 Expected Console Output When Working

**Background Script:**
```
[TogglePlay Background SIMPLE] Simple background script loaded
[TogglePlay Background SIMPLE] Received message: GET_TAB_ID from tab: 123
[TogglePlay Background SIMPLE] Received message: PLAYBACK_STATE_CHANGED from tab: 123
[TogglePlay Background SIMPLE] Tab 123 is now: PLAYING
[TogglePlay Background SIMPLE] Pausing paired tab 456
```

**Content Script:**
```
[TogglePlay Content SIMPLE-123] Simple content script initialized
[TogglePlay Content SIMPLE-123] New video found, setting up listeners
[TogglePlay Content SIMPLE-123] Video event: play, isPlaying: true
[TogglePlay Content SIMPLE-123] State change: PLAYING
[TogglePlay Content SIMPLE-123] Received message: CONTROL_PLAYBACK
```

## 🎯 Most Likely Issues

1. **Content script not injecting** - Refresh YouTube tabs
2. **Extension permissions** - Check manifest permissions
3. **Video not loaded** - Wait for video to fully load
4. **Service worker sleeping** - Click extension icon to wake it up
5. **YouTube updates** - YouTube's DOM structure might have changed

Let me know what console output you see and we can debug from there!
