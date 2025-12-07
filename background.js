/**
 * TogglePlay Extension - Background Service Worker
 * Manages communication between YouTube tabs
 */

// Simple configuration
const CONFIG = {
    STORAGE_KEYS: {
        PAIRS: 'togglePlayPairs',
        ENABLED: 'togglePlayEnabled'
    }
};

// Simple state
let state = {
    pairs: new Map(),
    isEnabled: true
};

function log(message, ...args) {
    console.log('[TogglePlay Background]', message, ...args);
}

function error(message, ...args) {
    console.error('[TogglePlay Background]', message, ...args);
}

/**
 * Simple message to tab function
 */
async function sendMessageToTab(tabId, message) {
    try {
        // Check if tab still exists
        await chrome.tabs.get(tabId);
        const response = await chrome.tabs.sendMessage(tabId, message);
        log(`Message sent to tab ${tabId}:`, message.type);
        return response;
    } catch (err) {
        // Silently ignore if tab doesn't exist or context is invalidated
        if (err.message?.includes('Extension context invalidated') ||
            err.message?.includes('No tab with id') ||
            err.message?.includes('Receiving end does not exist')) {
            log(`Tab ${tabId} no longer available, skipping`);
            return null;
        }
        error(`Failed to send message to tab ${tabId}:`, err);
        throw err;
    }
}

/**
 * Get YouTube tabs
 */
async function getYouTubeTabs() {
    try {
        const tabs = await chrome.tabs.query({
            url: ['https://www.youtube.com/*', 'https://youtube.com/*']
        });
        
        const videoTabs = tabs.filter(tab => 
            tab.url && tab.url.includes('/watch?')
        );
        
        log('Found YouTube tabs:', videoTabs.length);
        return videoTabs;
    } catch (err) {
        error('Failed to get YouTube tabs:', err);
        return [];
    }
}

/**
 * SIMPLE toggle logic - just opposite actions
 */
async function handlePlaybackStateChange(tabId, isPlaying) {
    if (!state.isEnabled) {
        log('Extension disabled');
        return;
    }
    
    const pairInfo = state.pairs.get(tabId);
    if (!pairInfo || !pairInfo.pairedWith || pairInfo.pairedWith.length === 0) {
        log('No pair found for tab', tabId);
        return;
    }
    
    log(`Tab ${tabId} is now:`, isPlaying ? 'PLAYING' : 'PAUSED');
    
    const pairedTabId = pairInfo.pairedWith[0].tabId;
    
    try {
        if (isPlaying) {
            // This tab started playing -> pause the other
            log(`Pausing paired tab ${pairedTabId}`);
            await sendMessageToTab(pairedTabId, {
                type: 'CONTROL_PLAYBACK',
                action: 'PAUSE'
            });
        } else {
            // This tab paused -> play the other
            log(`Playing paired tab ${pairedTabId}`);
            await sendMessageToTab(pairedTabId, {
                type: 'CONTROL_PLAYBACK',
                action: 'PLAY'
            });
        }
    } catch (err) {
        error('Failed to control paired tab:', err);
    }
}

/**
 * Add pair
 */
async function addPair(tabId1, tabId2) {
    try {
        log('Adding pair:', tabId1, '↔', tabId2);
        
        const [tab1, tab2] = await Promise.all([
            chrome.tabs.get(tabId1),
            chrome.tabs.get(tabId2)
        ]);
        
        // Clear existing pairs
        state.pairs.clear();
        
        // Add bidirectional pairing
        state.pairs.set(tabId1, {
            pairedWith: [{ tabId: tabId2, title: tab2.title, url: tab2.url }],
            title: tab1.title,
            url: tab1.url
        });
        
        state.pairs.set(tabId2, {
            pairedWith: [{ tabId: tabId1, title: tab1.title, url: tab1.url }],
            title: tab2.title,
            url: tab2.url
        });
        
        log('Pair added successfully');
        return { success: true };
    } catch (err) {
        error('Failed to add pair:', err);
        return { success: false, error: err.message };
    }
}

/**
 * Message listener
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    log('Received message:', message.type, 'from tab:', sender.tab?.id);
    
    const handleAsync = async () => {
        try {
            switch (message.type) {
                case 'GET_TAB_ID':
                    return { tabId: sender.tab?.id };
                
                case 'PLAYBACK_STATE_CHANGED':
                    await handlePlaybackStateChange(sender.tab.id, message.isPlaying);
                    return { success: true };
                
                case 'GET_TABS':
                    const tabs = await getYouTubeTabs();
                    return { 
                        success: true, 
                        tabs: tabs.map(tab => ({
                            id: tab.id,
                            title: tab.title,
                            url: tab.url
                        }))
                    };
                
                case 'GET_PAIRS':
                    const pairs = Array.from(state.pairs.entries()).map(([tabId, pairInfo]) => ({
                        tabId,
                        title: pairInfo.title,
                        pairedWith: pairInfo.pairedWith
                    }));
                    return { success: true, pairs, isEnabled: state.isEnabled };
                
                case 'ADD_PAIR':
                    return await addPair(message.tabId1, message.tabId2);
                
                case 'REMOVE_PAIR':
                    state.pairs.delete(message.tabId1);
                    state.pairs.delete(message.tabId2);
                    return { success: true };
                
                case 'CLEAR_ALL_PAIRS':
                    state.pairs.clear();
                    return { success: true };
                
                case 'SET_ENABLED':
                    state.isEnabled = message.enabled;
                    return { success: true };
                
                case 'PAUSE_BOTH':
                    // Pause both tabs in the pair
                    const senderTabId = sender.tab?.id;
                    const senderPairInfo = state.pairs.get(senderTabId);
                    
                    if (senderPairInfo && senderPairInfo.pairedWith && senderPairInfo.pairedWith.length > 0) {
                        const pairedTabId = senderPairInfo.pairedWith[0].tabId;
                        
                        // Temporarily disable toggle to prevent the pause from triggering play on the other tab
                        const wasEnabled = state.isEnabled;
                        state.isEnabled = false;
                        
                        // Pause the paired tab (current tab is already paused by content script)
                        await sendMessageToTab(pairedTabId, { type: 'CONTROL_PLAYBACK', action: 'PAUSE' });
                        
                        // Re-enable after a short delay to let the pause events settle
                        setTimeout(() => {
                            state.isEnabled = wasEnabled;
                            log('Re-enabled toggle after PAUSE_BOTH');
                        }, 500);
                        
                        log('Paused both tabs:', senderTabId, 'and', pairedTabId);
                        return { success: true, pausedTabs: [senderTabId, pairedTabId] };
                    }
                    
                    return { success: false, error: 'No paired tabs found' };
                
                case 'PING':
                    return { success: true, pong: true };
                
                default:
                    return { success: false, error: 'Unknown message type' };
            }
        } catch (err) {
            error('Error handling message:', err);
            return { success: false, error: err.message };
        }
    };
    
    handleAsync().then(sendResponse).catch(err => {
        error('Async handler failed:', err);
        sendResponse({ success: false, error: err.message });
    });
    
    return true;
});

log('Background script loaded');
