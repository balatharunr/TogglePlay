# TogglePlay Extension Development Guide

## Project Overview
TogglePlay is a browser extension that automatically toggles play/pause between different media tabs. When one tab plays media, other paired tabs will pause automatically, creating a seamless media experience.

## Development Roadmap

### Phase 1: YouTube Tab Synchronization
First focus on getting YouTube tabs to properly communicate and toggle playback.

## Detailed Implementation Prompts

---

## 1. Project Setup Prompt

```
I need to create a new browser extension called TogglePlay that automatically toggles play/pause between different media tabs. Please help me set up the basic file structure 
I'm building this extension completely for microsoft edge add-ons

The extension should have permissions for accessing tabs, storage, scripting, and executing scripts on YouTube.
```

---

## 2. YouTube Content Script Prompt

```
I need a robust content_youtube.js script that can detect and control YouTube video playback. The script should:

1. Detect when a YouTube video starts or stops playing using event listeners
2. Be able to programmatically play or pause the video element
3. Communicate with the background script when playback state changes
4. Accept commands from the background script to play/pause
5. Have robust error handling and reconnection logic if the page refreshes
6. Include unique tab identification to support multiple YouTube tabs
7. Handle YouTube's SPA (Single Page Application) navigation between videos
8. Use debouncing to prevent rapid state change notifications
9. Work with YouTube's dynamic DOM structure

Key implementation details:
- Listen for 'play', 'pause', and 'ended' events on video elements
- Use querySelector to find video elements
- Implement a 300ms debounce for state changes
- Handle both direct video API calls and UI button clicks for play/pause
- Include mutation observer for dynamic content loading

Please provide a complete implementation with comments explaining each section.
```

---

## 3. Background Script Prompt

```
I need a background.js service worker to manage communication between YouTube tabs. The script should:

1. Maintain a list of paired tabs that should toggle playback between each other
2. Listen for play/pause events from content scripts
3. When one tab in a pair starts playing, send a command to pause other tabs in the pair
4. Handle tab updates, refreshes, and closures gracefully
5. Provide methods for the popup to get tab information and manage pairs
6. Include proper error handling and reconnection logic
7. Store paired tabs in chrome.storage.sync so they persist across sessions
8. Implement retry logic for failed tab communications
9. Clean up invalid pairs when tabs are closed
10. Support both YouTube-to-YouTube bidirectional communication

Key features:
- Implement sendMessageWithRetry function for robust messaging
- Store settings in edge
- Clean up pairs when tabs are removed
- Validate tab existence before sending commands

Please provide a complete implementation with error handling and comments.
```

---

## 4. UI Design 
Check popup.css, popup.js, and popup.html 
Don't make any changes in ui.
the active pairs section can only contain one pair, if another pair is selected then the existing pair should be replaced. 
---

## 5. YouTube Testing & Debugging Prompt

Common issues to address:
- Extension context invalidation errors
- Content scripts not loading on page refresh
- Race conditions with rapid play/pause events
- YouTube's dynamic DOM structure changes
- Cross-tab communication failures

Please provide fixes for both content_youtube.js and background.js with explanations of what was causing the issues and how the fixes resolve them.
```

---
Integration rules:
- YouTube ↔ YouTube: Full bidirectional communication
- Two tabs, first is primary and second is secondary tab, the current viewing tab will be displayed as primary and secondary tab displays all available tabs, so when user selects a tab it automatically goes to active tab area which is working area, only one pair is allowed when user tries to add another pair the active tab should be replaced with new one.
- when the primary tab is playing seconday tab should pause, when primary is paused secondary should starts to play automatically, when primary is paused and secondary is playing and primary paused secondary is paused both tabs are paused.

Please provide the updated background.js and any necessary popup.js changes with explanations of how the integration works.
```
