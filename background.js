// Background script for TogglePlay extension
let togglePairs = [];
let isToggleEnabled = false;

// Initialize storage
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(['togglePairs', 'isToggleEnabled'], (result) => {
    togglePairs = result.togglePairs || [];
    isToggleEnabled = result.isToggleEnabled || false;
  });
});

// Load settings on startup
chrome.storage.sync.get(['togglePairs', 'isToggleEnabled'], (result) => {
  togglePairs = result.togglePairs || [];
  isToggleEnabled = result.isToggleEnabled || false;
});

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!isToggleEnabled) return;

  try {
    if (message.action === 'mediaStateChanged') {
      handleMediaStateChange(message, sender.tab.id);
    } else if (message.action === 'getTogglePairs') {
      sendResponse({ togglePairs, isToggleEnabled });
    } else if (message.action === 'updateSettings') {
      togglePairs = message.togglePairs;
      isToggleEnabled = message.isToggleEnabled;
      chrome.storage.sync.set({ togglePairs, isToggleEnabled });
      sendResponse({ success: true });
    } else if (message.action === 'getCurrentTab') {
      sendResponse({ tabId: sender.tab.id, url: sender.tab.url });
    }
  } catch (error) {
    console.log('Background script error:', error);
    sendResponse({ error: error.message });
  }
  
  return true; // Keep message channel open for async response
});

function handleMediaStateChange(message, tabId) {
  const { isPlaying, mediaType } = message;
  
  // Find if this tab is part of any toggle pair
  const activePair = togglePairs.find(pair => 
    pair.tab1.id === tabId || pair.tab2.id === tabId
  );
  
  if (!activePair) return;
  
  const otherTabId = activePair.tab1.id === tabId ? activePair.tab2.id : activePair.tab1.id;
  
  // Check if other tab still exists
  chrome.tabs.get(otherTabId, (tab) => {
    if (chrome.runtime.lastError) {
      // Tab doesn't exist anymore, remove the pair
      removeInvalidPairs();
      return;
    }
    
    // Send message to other tab with error handling
    try {
      if (isPlaying) {
        // If media started playing in this tab, pause the other tab
        chrome.tabs.sendMessage(otherTabId, { action: 'pauseMedia' }, () => {
          if (chrome.runtime.lastError) {
            // Silently ignore errors (tab might be loading or content script not ready)
          }
        });
      } else {
        // If media was paused in this tab, start playing in the other tab
        chrome.tabs.sendMessage(otherTabId, { action: 'playMedia' }, () => {
          if (chrome.runtime.lastError) {
            // Silently ignore errors (tab might be loading or content script not ready)
          }
        });
      }
    } catch (error) {
      console.log('Error sending message to tab:', error);
    }
  });
}

function removeInvalidPairs() {
  const validPairs = [];
  
  togglePairs.forEach(pair => {
    // Check if both tabs still exist
    chrome.tabs.get(pair.tab1.id, (tab1) => {
      if (!chrome.runtime.lastError) {
        chrome.tabs.get(pair.tab2.id, (tab2) => {
          if (!chrome.runtime.lastError) {
            validPairs.push(pair);
          }
        });
      }
    });
  });
  
  setTimeout(() => {
    togglePairs = validPairs;
    chrome.storage.sync.set({ togglePairs });
  }, 1000);
}

// Clean up invalid pairs periodically
setInterval(removeInvalidPairs, 60000); // Every minute

// Listen for tab removal to clean up pairs
chrome.tabs.onRemoved.addListener((tabId) => {
  togglePairs = togglePairs.filter(pair => 
    pair.tab1.id !== tabId && pair.tab2.id !== tabId
  );
  chrome.storage.sync.set({ togglePairs });
});