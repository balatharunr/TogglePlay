# TogglePlay Testing Guide - Core Functionality

## 🔧 Updated Features

The extension has been updated with improved toggle logic to handle complex state transitions properly.

## 🧪 Testing the Fixed Core Functionality

### Step 1: Reload the Extension
1. Go to `edge://extensions/`
2. Find the TogglePlay extension
3. Click the **"Reload"** button
4. Refresh your YouTube tabs

### Step 2: Set Up Test Tabs
Open these two YouTube videos in separate tabs:
- Tab A: https://www.youtube.com/watch?v=dQw4w9WgXcQ
- Tab B: https://www.youtube.com/watch?v=9bZkp7q19f0

### Step 3: Create the Pair
1. Click the TogglePlay extension icon
2. Ensure toggle is "ON"
3. Go to Tab A (it becomes Primary)
4. Select Tab B from Secondary list
5. Verify pair appears in "Active Pairs"

### Step 4: Test Core Toggle Logic

**Test 1: Basic Toggle**
- ✅ **Play Tab A** → Tab B should pause automatically
- ✅ **Pause Tab A** → Tab B should play automatically

**Test 2: Reverse Toggle**
- ✅ Switch to Tab B, **Play Tab B** → Tab A should pause
- ✅ **Pause Tab B** → Tab A should play

**Test 3: Complex State Transitions**
- ✅ **Both paused** → Play either tab → Other pauses
- ✅ **Tab A playing, Tab B paused** → Pause Tab A → Tab B plays
- ✅ **Tab B playing, Tab A paused** → Pause Tab B → Tab A plays
- ✅ **Both paused state** → Pause first tab → Other tab plays, pause second tab → Both stay paused

### Step 5: Debug if Issues Persist

**Open Browser Console (F12):**
```javascript
// Check extension logs
// Look for these prefixes:
// [TogglePlay Background] - Service worker logs
// [TogglePlay Content-{tabId}] - Content script logs

// Check current pairs
chrome.storage.sync.get(['togglePlayPairs'], console.log)

// Check extension status
chrome.runtime.sendMessage({type: 'GET_PAIRS'}, console.log)
```

## 🔍 Key Improvements Made

1. **Enhanced State Management**: Added proper state tracking for both tabs
2. **Debounced Actions**: Increased debounce delay to 500ms for stability  
3. **Command Isolation**: Prevents feedback loops from our own control commands
4. **Complex Logic**: Implements the exact state transitions you specified:
   - Primary plays → Secondary pauses
   - Primary pauses → Secondary plays  
   - Both paused → Toggle works properly
   - Either tab can act as "primary" when user interacts

5. **Better Error Handling**: Improved communication between tabs
6. **Fallback Methods**: Multiple ways to control YouTube playback

## 🚨 Expected Behavior Summary

```
State Transitions:
A=Playing, B=Paused  →  Pause A  →  A=Paused, B=Playing
A=Paused, B=Playing  →  Pause B  →  A=Playing, B=Paused  
A=Paused, B=Paused   →  Play A   →  A=Playing, B=Paused
A=Paused, B=Paused   →  Play B   →  A=Paused, B=Playing

Special Cases:
- When user manually pauses both tabs → Both stay paused
- Only one tab plays at a time (never both playing)
- Either tab can initiate the toggle by playing/pausing
```

## 🐛 If Still Not Working

1. **Check browser console** for error messages
2. **Refresh both YouTube tabs** after reloading extension
3. **Try different YouTube videos** (some may have loading issues)
4. **Ensure videos are fully loaded** before testing
5. **Test with simple videos** first (not live streams or premieres)

The core toggle functionality should now work exactly as specified in your requirements!
