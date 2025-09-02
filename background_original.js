/**
 * TogglePlay Extension - Background Service Worker
 * Manages communication between YouTube tabs with robust error handling
 */

// Configuration
const CONFIG = {
    RETRY_DELAY: 1000,
    MAX_RETRIES: 3,
    CLEANUP_INTERVAL: 60000,
    MESSAGE_TIMEOUT: 5000,
    STORAGE_KEYS: {
        PAIRS: 'togglePlayPairs',
        ENABLED: 'togglePlayEnabled',
        SETTINGS: 'togglePlaySettings'
    }
};

// Global state
let state = {
    pairs: new Map(), // tabId -> { pairedWith: [tabInfo], title, url }
    isEnabled: true,
    activeConnections: new Set(),
    cleanupTimer: null,
    tabStates: new Map(), // tabId -> { isPlaying, lastUpdate, pendingAction }
    stateChangeDebounce: new Map() // tabId -> timeoutId
};

// Logging utility
function log(message, ...args) {
    console.log('[TogglePlay Background]', message, ...args);
}

function error(message, ...args) {
    console.error('[TogglePlay Background]', message, ...args);
}

/**
 * Initialize extension
 */
async function initialize() {
    try {
        log('Initializing background script');
        
        // Load saved data
        await loadStoredData();
        
        // Set up periodic cleanup
        startPeriodicCleanup();
        
        // Clean up invalid pairs on startup
        await cleanupInvalidPairs();
        
        log('Background script initialized successfully');
        log('Current state:', {
            pairs: state.pairs.size,
            enabled: state.isEnabled
        });
        
    } catch (err) {
        error('Failed to initialize background script:', err);
    }
}

/**
 * Load stored data from chrome.storage
 */
async function loadStoredData() {
    try {
        const result = await chrome.storage.sync.get([
            CONFIG.STORAGE_KEYS.PAIRS,
            CONFIG.STORAGE_KEYS.ENABLED,
            CONFIG.STORAGE_KEYS.SETTINGS
        ]);
        
        // Load pairs
        if (result[CONFIG.STORAGE_KEYS.PAIRS]) {
            const storedPairs = result[CONFIG.STORAGE_KEYS.PAIRS];
            state.pairs = new Map(Object.entries(storedPairs).map(([key, value]) => [parseInt(key), value]));
            log('Loaded pairs from storage:', state.pairs.size);
        }
        
        // Load enabled state
        state.isEnabled = result[CONFIG.STORAGE_KEYS.ENABLED] !== false;
        log('Enabled state loaded:', state.isEnabled);
        
    } catch (err) {
        error('Failed to load stored data:', err);
        // Continue with default values
    }
}

/**
 * Save data to chrome.storage
 */
async function saveStoredData() {
    try {
        const pairsObject = Object.fromEntries(state.pairs);
        
        await chrome.storage.sync.set({
            [CONFIG.STORAGE_KEYS.PAIRS]: pairsObject,
            [CONFIG.STORAGE_KEYS.ENABLED]: state.isEnabled
        });
        
        log('Data saved to storage');
    } catch (err) {
        error('Failed to save data to storage:', err);
    }
}

/**
 * Send message to tab with retry logic
 */
async function sendMessageToTab(tabId, message, retries = CONFIG.MAX_RETRIES) {
    for (let i = 0; i <= retries; i++) {
        try {
            // Check if tab exists
            const tab = await chrome.tabs.get(tabId);
            if (!tab) {
                throw new Error('Tab not found');
            }
            
            // Send message with timeout
            const response = await Promise.race([
                chrome.tabs.sendMessage(tabId, message),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Message timeout')), CONFIG.MESSAGE_TIMEOUT)
                )
            ]);
            
            if (chrome.runtime.lastError) {
                throw new Error(chrome.runtime.lastError.message);
            }
            
            log(`Message sent to tab ${tabId}:`, message.type);
            return response;
            
        } catch (err) {
            if (i === retries) {
                error(`Failed to send message to tab ${tabId} after ${retries + 1} attempts:`, err);
                throw err;
            }
            
            log(`Message send attempt ${i + 1} to tab ${tabId} failed, retrying...`, err.message);
            await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY * (i + 1)));
        }
    }
}

/**
 * Get all YouTube tabs
 */
async function getYouTubeTabs() {
    try {
        const tabs = await chrome.tabs.query({
            url: [
                'https://www.youtube.com/*',
                'https://youtube.com/*',
                'https://youtu.be/*'
            ]
        });
        
        // Filter for actual video pages
        const videoTabs = tabs.filter(tab => 
            tab.url && (
                tab.url.includes('/watch?') ||
                tab.url.includes('/shorts/') ||
                tab.url.includes('youtu.be/')
            )
        );
        
        log('Found YouTube tabs:', videoTabs.length);
        return videoTabs;
        
    } catch (err) {
        error('Failed to get YouTube tabs:', err);
        return [];
    }
}

/**
 * Add a new pair (replacing any existing pairs)
 */
async function addPair(tabId1, tabId2) {
    try {
        log('Adding pair:', tabId1, '↔', tabId2);
        
        // Validate tabs exist
        const [tab1, tab2] = await Promise.all([
            chrome.tabs.get(tabId1),
            chrome.tabs.get(tabId2)
        ]);
        
        if (!tab1 || !tab2) {
            throw new Error('One or both tabs not found');
        }
        
        // Clear all existing pairs first (only one pair allowed)
        state.pairs.clear();
        
        // Create bidirectional pairing
        const pairInfo1 = {
            tabId: tabId2,
            title: tab2.title || 'YouTube Video',
            url: tab2.url
        };
        
        const pairInfo2 = {
            tabId: tabId1,
            title: tab1.title || 'YouTube Video',
            url: tab1.url
        };
        
        state.pairs.set(tabId1, {
            pairedWith: [pairInfo1],
            title: tab1.title || 'YouTube Video',
            url: tab1.url
        });
        
        state.pairs.set(tabId2, {
            pairedWith: [pairInfo2],
            title: tab2.title || 'YouTube Video',
            url: tab2.url
        });
        
        // Save to storage
        await saveStoredData();
        
        log('Pair added successfully:', {
            tab1: `${tabId1} (${tab1.title})`,
            tab2: `${tabId2} (${tab2.title})`
        });
        
        return { success: true };
        
    } catch (err) {
        error('Failed to add pair:', err);
        return { success: false, error: err.message };
    }
}

/**
 * Remove a specific pair
 */
async function removePair(tabId1, tabId2) {
    try {
        log('Removing pair:', tabId1, '↔', tabId2);
        
        // Remove both directions of the pairing
        state.pairs.delete(tabId1);
        state.pairs.delete(tabId2);
        
        // Save to storage
        await saveStoredData();
        
        log('Pair removed successfully');
        return { success: true };
        
    } catch (err) {
        error('Failed to remove pair:', err);
        return { success: false, error: err.message };
    }
}

/**
 * Clear all pairs
 */
async function clearAllPairs() {
    try {
        log('Clearing all pairs');
        
        state.pairs.clear();
        
        // Save to storage
        await saveStoredData();
        
        log('All pairs cleared successfully');
        return { success: true };
        
    } catch (err) {
        error('Failed to clear all pairs:', err);
        return { success: false, error: err.message };
    }
}

/**
 * Clean up invalid pairs
 */
async function cleanupInvalidPairs() {
    try {
        const validTabs = await getYouTubeTabs();
        const validTabIds = new Set(validTabs.map(tab => tab.id));
        
        let removedCount = 0;
        
        // Check each pair for invalid tabs
        for (const [tabId, pairInfo] of state.pairs.entries()) {
            if (!validTabIds.has(tabId)) {
                state.pairs.delete(tabId);
                removedCount++;
                
                // Also remove the reverse pairing
                if (pairInfo.pairedWith && pairInfo.pairedWith.length > 0) {
                    const pairedTabId = pairInfo.pairedWith[0].tabId;
                    state.pairs.delete(pairedTabId);
                }
            }
        }
        
        if (removedCount > 0) {
            log('Cleaned up invalid pairs:', removedCount);
            await saveStoredData();
        }
        
    } catch (err) {
        error('Failed to cleanup invalid pairs:', err);
    }
}

/**
 * Start periodic cleanup
 */
function startPeriodicCleanup() {
    if (state.cleanupTimer) {
        clearInterval(state.cleanupTimer);
    }
    
    state.cleanupTimer = setInterval(async () => {
        await cleanupInvalidPairs();
    }, CONFIG.CLEANUP_INTERVAL);
    
    log('Periodic cleanup started');
}

/**
 * Handle playback state change with complex toggle logic
 */
async function handlePlaybackStateChange(tabId, isPlaying, tabInfo) {
    if (!state.isEnabled) {
        log('Extension disabled, ignoring playback state change');
        return;
    }
    
    // Clear any pending debounce for this tab
    if (state.stateChangeDebounce.has(tabId)) {
        clearTimeout(state.stateChangeDebounce.get(tabId));
    }
    
    // Debounce state changes to prevent rapid toggling
    const debounceId = setTimeout(async () => {
        await processStateChange(tabId, isPlaying, tabInfo);
        state.stateChangeDebounce.delete(tabId);
    }, 100);
    
    state.stateChangeDebounce.set(tabId, debounceId);
}

/**
 * Process the actual state change with complex logic
 */
async function processStateChange(tabId, isPlaying, tabInfo) {
    const pairInfo = state.pairs.get(tabId);
    if (!pairInfo || !pairInfo.pairedWith || pairInfo.pairedWith.length === 0) {
        log('No pair found for tab', tabId);
        return;
    }
    
    // Update this tab's state
    state.tabStates.set(tabId, {
        isPlaying: isPlaying,
        lastUpdate: Date.now(),
        pendingAction: null
    });
    
    log(`Tab ${tabId} playback state changed:`, isPlaying ? 'PLAYING' : 'PAUSED');
    
    // Process each paired tab
    for (const pairedTab of pairInfo.pairedWith) {
        try {
            const pairedTabId = pairedTab.tabId;
            
            // Get current state of paired tab
            const pairedTabState = await sendMessageToTab(pairedTabId, {
                type: 'GET_PLAYBACK_STATE'
            });
            
            const pairedTabPlaying = pairedTabState?.isPlaying || false;
            
            // Update paired tab state
            state.tabStates.set(pairedTabId, {
                isPlaying: pairedTabPlaying,
                lastUpdate: Date.now(),
                pendingAction: null
            });
            
            log(`State check - Tab ${tabId}: ${isPlaying ? 'PLAYING' : 'PAUSED'}, Tab ${pairedTabId}: ${pairedTabPlaying ? 'PLAYING' : 'PAUSED'}`);
            
            // Apply toggle logic
            if (isPlaying) {
                // Rule 1: When any tab starts playing, pause the other
                if (pairedTabPlaying) {
                    log(`Tab ${tabId} playing, pausing paired tab ${pairedTabId}`);
                    
                    await sendMessageToTab(pairedTabId, {
                        type: 'CONTROL_PLAYBACK',
                        action: 'PAUSE',
                        reason: 'OTHER_TAB_PLAYING'
                    });
                }
                
            } else {
                // Tab paused - implement complex logic
                if (pairedTabPlaying) {
                    // Rule: If paired tab is playing and this tab paused, start this tab and pause the other
                    log(`Tab ${tabId} paused while ${pairedTabId} was playing - implementing toggle`);
                    
                    // First pause the currently playing tab
                    await sendMessageToTab(pairedTabId, {
                        type: 'CONTROL_PLAYBACK',
                        action: 'PAUSE',
                        reason: 'TOGGLE_PAUSE'
                    });
                    
                    // Then start the paused tab (with delay to ensure proper sequence)
                    setTimeout(async () => {
                        try {
                            await sendMessageToTab(tabId, {
                                type: 'CONTROL_PLAYBACK',
                                action: 'PLAY',
                                reason: 'TOGGLE_PLAY'
                            });
                        } catch (err) {
                            error(`Failed to start tab ${tabId} in toggle:`, err);
                        }
                    }, 300);
                    
                } else {
                    // Both tabs are paused - start the paired tab
                    log(`Tab ${tabId} paused, both tabs paused - starting paired tab ${pairedTabId}`);
                    
                    await sendMessageToTab(pairedTabId, {
                        type: 'CONTROL_PLAYBACK',
                        action: 'PLAY',
                        reason: 'START_OTHER_TAB'
                    });
                }
            }
            
        } catch (err) {
            error(`Failed to control paired tab ${pairedTab.tabId}:`, err);
            
            // Clean up invalid pairing if tab doesn't exist
            if (err.message.includes('Tab not found')) {
                await cleanupInvalidPairs();
            }
        }
    }
}

/**
 * Set up message listeners
 */
function setupMessageListeners() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        log('Received message:', message.type, 'from tab:', sender.tab?.id);
        
        const handleAsync = async () => {
            try {
                switch (message.type) {
                    case 'GET_TAB_ID':
                        return { tabId: sender.tab?.id };
                    
                    case 'PLAYBACK_STATE_CHANGED':
                        await handlePlaybackStateChange(
                            sender.tab.id, 
                            message.isPlaying,
                            {
                                title: message.title,
                                url: message.url
                            }
                        );
                        return { success: true };
                    
                    case 'GET_TABS':
                        const tabs = await getYouTubeTabs();
                        return { 
                            success: true, 
                            tabs: tabs.map(tab => ({
                                id: tab.id,
                                title: tab.title,
                                url: tab.url,
                                active: tab.active
                            }))
                        };
                    
                    case 'GET_PAIRS':
                        const pairs = Array.from(state.pairs.entries()).map(([tabId, pairInfo]) => ({
                            tabId,
                            title: pairInfo.title,
                            url: pairInfo.url,
                            pairedWith: pairInfo.pairedWith
                        }));
                        return { 
                            success: true, 
                            pairs,
                            isEnabled: state.isEnabled
                        };
                    
                    case 'ADD_PAIR':
                        return await addPair(message.tabId1, message.tabId2);
                    
                    case 'REMOVE_PAIR':
                        return await removePair(message.tabId1, message.tabId2);
                    
                    case 'CLEAR_ALL_PAIRS':
                        return await clearAllPairs();
                    
                    case 'SET_ENABLED':
                        state.isEnabled = message.enabled;
                        await saveStoredData();
                        log('Extension enabled state changed:', state.isEnabled);
                        return { success: true };
                    
                    case 'HEARTBEAT':
                        state.activeConnections.add(sender.tab?.id);
                        return { success: true, timestamp: Date.now() };
                    
                    case 'PING':
                        return { success: true, pong: true };
                    
                    default:
                        log('Unknown message type:', message.type);
                        return { success: false, error: 'Unknown message type' };
                }
                
            } catch (err) {
                error('Error handling message:', err);
                return { success: false, error: err.message };
            }
        };
        
        // Handle async operations
        handleAsync().then(sendResponse).catch(err => {
            error('Async message handler failed:', err);
            sendResponse({ success: false, error: err.message });
        });
        
        return true; // Keep message channel open for async response
    });
    
    log('Message listeners registered');
}

/**
 * Set up tab listeners
 */
function setupTabListeners() {
    // Clean up pairs when tabs are removed
    chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
        log('Tab removed:', tabId);
        
        if (state.pairs.has(tabId)) {
            const pairInfo = state.pairs.get(tabId);
            
            // Remove the pair
            state.pairs.delete(tabId);
            
            // Also remove reverse pairing
            if (pairInfo.pairedWith && pairInfo.pairedWith.length > 0) {
                const pairedTabId = pairInfo.pairedWith[0].tabId;
                state.pairs.delete(pairedTabId);
            }
            
            await saveStoredData();
            log('Cleaned up pairs for removed tab:', tabId);
        }
        
        state.activeConnections.delete(tabId);
    });
    
    // Update tab info when tabs are updated
    chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
        if (changeInfo.title && state.pairs.has(tabId)) {
            const pairInfo = state.pairs.get(tabId);
            pairInfo.title = changeInfo.title;
            pairInfo.url = tab.url;
            await saveStoredData();
            log('Updated tab info for:', tabId);
        }
    });
    
    log('Tab listeners registered');
}

/**
 * Handle extension startup
 */
chrome.runtime.onStartup.addListener(async () => {
    log('Extension startup detected');
    await initialize();
});

/**
 * Handle extension installation
 */
chrome.runtime.onInstalled.addListener(async (details) => {
    log('Extension installed/updated:', details.reason);
    await initialize();
});

// Set up all listeners
setupMessageListeners();
setupTabListeners();

// Initialize immediately
initialize();
