/**
 * TogglePlay Extension - Popup Logic
 * Updated to match new HTML structure with Primary/Secondary tabs
 */

// DOM Elements
const elements = {
    enableToggle: null,
    statusIndicator: null,
    statusText: null,
    currentTab: null,
    availableTabs: null,
    togglePairs: null
};

// State
let state = {
    currentTabId: null,
    selectedTabId: null,
    availableTabs: [],
    activePairs: [],
    isEnabled: true,
    isLoading: false
};

// Logging utility
function log(message, ...args) {
    console.log('[TogglePlay Popup]', message, ...args);
}

function error(message, ...args) {
    console.error('[TogglePlay Popup]', message, ...args);
}

/**
 * Initialize DOM element references
 */
function initializeElements() {
    elements.enableToggle = document.getElementById('enableToggle');
    elements.statusIndicator = document.getElementById('statusIndicator');
    elements.statusText = document.getElementById('statusText');
    elements.currentTab = document.getElementById('currentTab');
    elements.availableTabs = document.getElementById('availableTabs');
    elements.togglePairs = document.getElementById('togglePairs');
}

/**
 * Show notification
 */
function showNotification(message, type = 'success') {
    // Remove existing notifications
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    // Create new notification
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 3000);
}

/**
 * Update status indicator
 */
function updateStatus(status, message) {
    elements.statusIndicator.className = `status-dot ${status}`;
    elements.statusText.textContent = message;
}

/**
 * Send message to background script
 */
async function sendMessage(message) {
    try {
        // Check if Chrome runtime is available
        if (!chrome || !chrome.runtime || !chrome.runtime.sendMessage) {
            throw new Error('Chrome runtime not available');
        }
        
        log('Sending message to background:', message.type);
        const response = await chrome.runtime.sendMessage(message);
        
        if (chrome.runtime.lastError) {
            throw new Error(chrome.runtime.lastError.message);
        }
        
        if (response && response.success === false && response.error) {
            throw new Error(response.error);
        }
        
        log('Received response:', response);
        return response;
    } catch (err) {
        error('Failed to send message to background:', err);
        throw err;
    }
}

/**
 * Get current tab information
 */
async function getCurrentTab() {
    try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        return tabs[0];
    } catch (err) {
        error('Failed to get current tab:', err);
        return null;
    }
}

/**
 * Load available YouTube tabs
 */
async function loadAvailableTabs() {
    try {
        log('Loading available tabs...');
        const response = await sendMessage({ type: 'GET_TABS' });
        state.availableTabs = response.tabs || [];
        
        // Get current tab
        const currentTab = await getCurrentTab();
        state.currentTabId = currentTab?.id;
        
        log('Current tab:', currentTab?.url);
        log('All YouTube tabs found:', state.availableTabs.length);
        
        // Filter out current tab from available tabs
        state.availableTabs = state.availableTabs.filter(tab => tab.id !== state.currentTabId);
        
        renderCurrentTab(currentTab);
        renderAvailableTabs();
        
        log('Loaded tabs:', { current: state.currentTabId, available: state.availableTabs.length });
    } catch (err) {
        error('Failed to load available tabs:', err);
        
        // Set default state on error
        state.availableTabs = [];
        state.currentTabId = null;
        
        // Render empty state
        renderCurrentTab(null);
        renderAvailableTabs();
        
        // Only show error in console, not to user during initialization
        if (err.message && !err.message.includes('Chrome runtime not available')) {
            updateStatus('error', 'Failed to load tabs');
        }
    }
}

/**
 * Load active pairs
 */
async function loadActivePairs() {
    try {
        log('Loading active pairs...');
        const response = await sendMessage({ type: 'GET_PAIRS' });
        state.activePairs = response.pairs || [];
        state.isEnabled = response.isEnabled !== false;
        
        log('Loaded pairs:', state.activePairs.length, 'isEnabled:', state.isEnabled);
        
        // Update enable toggle
        elements.enableToggle.checked = state.isEnabled;
        
        renderActivePairs();
        
        log('Loaded pairs:', state.activePairs.length);
    } catch (err) {
        error('Failed to load active pairs:', err);
        
        // Set default state on error
        state.activePairs = [];
        state.isEnabled = false;
        elements.enableToggle.checked = false;
        
        // Render empty state
        renderActivePairs();
        
        // Only show error in console, not to user during initialization
        if (err.message && !err.message.includes('Chrome runtime not available')) {
            updateStatus('error', 'Failed to load pairs');
        }
    }
}

/**
 * Render current tab (Primary tab)
 */
function renderCurrentTab(tab) {
    const container = elements.currentTab;
    
    if (!tab || !tab.url || !TogglePlayPlatforms.isMediaUrl(tab.url)) {
        container.innerHTML = `
            <div class="tab-info">
                <span class="tab-title">No media tab active</span>
                <span class="tab-url">Navigate to YouTube, YouTube Music, or Spotify</span>
            </div>
            <div class="tab-status">
                <span class="status-indicator inactive"></span>
            </div>
        `;
        return;
    }
    
    const title = tab.title || 'Media';
    const sourceType = TogglePlayPlatforms.getSourceType(tab.url);
    const icon = TogglePlayPlatforms.getSourceIcon(sourceType);
    let displayUrl = '';
    
    try {
        displayUrl = new URL(tab.url).hostname;
    } catch (e) {
        if (sourceType === 'spotify') {
            displayUrl = 'open.spotify.com';
        } else if (sourceType === 'ytmusic') {
            displayUrl = 'music.youtube.com';
        } else {
            displayUrl = 'youtube.com';
        }
    }
    
    container.innerHTML = `
        <div class="tab-info">
            <span class="tab-title">${icon} ${escapeHtml(title)}</span>
            <span class="tab-url">${escapeHtml(displayUrl)}</span>
        </div>
        <div class="tab-status">
            <span class="status-indicator active"></span>
        </div>
    `;
}

/**
 * Render available tabs (Secondary tabs)
 */
function renderAvailableTabs() {
    const container = elements.availableTabs;
    
    if (state.availableTabs.length === 0) {
        container.innerHTML = `
            <div class="no-available-tabs">No other YouTube, YouTube Music, or Spotify tabs found</div>
        `;
        return;
    }
    
    const tabsHtml = state.availableTabs.map(tab => {
        const title = tab.title || 'Media';
        const sourceType = tab.sourceType || TogglePlayPlatforms.getSourceType(tab.url);
        const icon = TogglePlayPlatforms.getSourceIcon(sourceType);
        let displayUrl = '';
        
        try {
            displayUrl = new URL(tab.url).hostname;
        } catch (e) {
            if (sourceType === 'spotify') {
                displayUrl = 'open.spotify.com';
            } else if (sourceType === 'ytmusic') {
                displayUrl = 'music.youtube.com';
            } else {
                displayUrl = 'youtube.com';
            }
        }
        
        const isSelected = tab.id === state.selectedTabId;
        
        return `
            <div class="available-tab-item ${isSelected ? 'selected' : ''}" data-tab-id="${tab.id}">
                <div class="available-tab-info">
                    <span class="available-tab-title">${icon} ${escapeHtml(title)}</span>
                    <span class="available-tab-url">${escapeHtml(displayUrl)}</span>
                </div>
                <button class="select-button" data-tab-id="${tab.id}">
                    ${isSelected ? 'Selected' : 'Select'}
                </button>
            </div>
        `;
    }).join('');
    
    container.innerHTML = tabsHtml;
}

/**
 * Render active pairs
 */
function renderActivePairs() {
    const container = elements.togglePairs;
    
    if (state.activePairs.length === 0) {
        container.innerHTML = `
            <div class="no-pairs">No active pair configured</div>
        `;
        return;
    }
    
    // Only show the first pair since only one is allowed
    const firstPair = state.activePairs[0];
    if (!firstPair || !firstPair.pairedWith || firstPair.pairedWith.length === 0) {
        container.innerHTML = `
            <div class="no-pairs">No active pair configured</div>
        `;
        return;
    }
    
    const pairedTab = firstPair.pairedWith[0];
    const title1 = firstPair.title || 'Media';
    const title2 = pairedTab.title || 'Media';
    const icon1 = TogglePlayPlatforms.getSourceIcon(firstPair.sourceType || TogglePlayPlatforms.getSourceType(firstPair.url));
    const icon2 = TogglePlayPlatforms.getSourceIcon(pairedTab.sourceType || TogglePlayPlatforms.getSourceType(pairedTab.url));
    
    const pairHtml = `
        <div class="pair-item">
            <div class="pair-tabs">
                <div class="pair-tab">
                    <div class="pair-tab-title">${icon1} ${escapeHtml(title1)}</div>
                    <div class="pair-tab-url">Tab ${firstPair.tabId}</div>
                </div>
                <div class="pair-arrow">↔</div>
                <div class="pair-tab">
                    <div class="pair-tab-title">${icon2} ${escapeHtml(title2)}</div>
                    <div class="pair-tab-url">Tab ${pairedTab.tabId}</div>
                </div>
            </div>
            <button class="remove-pair-btn" data-tab1="${firstPair.tabId}" data-tab2="${pairedTab.tabId}">
                ×
            </button>
        </div>
    `;
    
    container.innerHTML = pairHtml;
}

/**
 * Handle tab selection - Always replace existing pair
 */
async function handleTabSelection(tabId) {
    if (!state.currentTabId) {
        return; // Silent fail - no notification needed
    }
    
    if (tabId === state.currentTabId) {
        return; // Silent fail - cannot pair with self
    }
    
    // Check if we're deselecting the same tab
    if (state.selectedTabId === tabId) {
        // Deselect and clear all pairs
        state.selectedTabId = null;
        await removeAllPairs();
        renderAvailableTabs();
        return;
    }
    
    // Always create/replace pair - no selection state needed
    try {
        log('Creating/replacing pair between tabs:', state.currentTabId, tabId);
        
        // Send ADD_PAIR which will automatically clear existing pairs and create new one
        const response = await sendMessage({
            type: 'ADD_PAIR',
            tabId1: state.currentTabId,
            tabId2: tabId
        });
        
        if (response && response.success !== false) {
            // Auto-enable silently if not enabled
            if (!state.isEnabled) {
                await sendMessage({ type: 'SET_ENABLED', enabled: true });
                state.isEnabled = true;
                elements.enableToggle.checked = true;
            }
            
            // Reload and refresh UI
            await loadActivePairs();
            renderAvailableTabs();
        } else {
            error('Failed to create pair:', response?.error);
        }
    } catch (err) {
        error('Failed to create pair:', err);
    }
}
/**
 * Remove all pairs globally
 */
async function removeAllPairs() {
    try {
        log('Removing all pairs');
        
        const response = await sendMessage({
            type: 'CLEAR_ALL_PAIRS'
        });
        
        if (response && response.success !== false) {
            log('All pairs removed successfully');
        } else {
            error('Failed to remove all pairs:', response?.error);
        }
        
        // Reload pairs to reflect changes
        await loadActivePairs();
    } catch (err) {
        error('Error removing all pairs:', err);
    }
}

/**
 * Handle pair removal
 */
async function handlePairRemoval(tab1Id, tab2Id) {
    try {
        log('Removing pair:', tab1Id, tab2Id);
        
        const response = await sendMessage({
            type: 'REMOVE_PAIR',
            tabId1: parseInt(tab1Id),
            tabId2: parseInt(tab2Id)
        });
        
        if (response && response.success !== false) {
            showNotification('Pair removed successfully', 'success');
            await loadActivePairs();
        } else {
            throw new Error(response?.error || 'Failed to remove pair');
        }
    } catch (err) {
        error('Failed to remove pair:', err);
        showNotification('Failed to remove pair: ' + err.message, 'error');
    }
}

/**
 * Handle enable/disable toggle
 */
async function handleToggleEnable(enabled) {
    try {
        log('Toggling enable state to:', enabled);
        
        const response = await sendMessage({
            type: 'SET_ENABLED',
            enabled: enabled
        });
        
        if (response && response.success !== false) {
            state.isEnabled = enabled;
            updateStatus('', enabled ? 'Extension enabled' : 'Extension disabled');
        } else {
            // Silent fail - just revert toggle
            elements.enableToggle.checked = state.isEnabled;
            error('Failed to update enabled state:', response?.error);
        }
    } catch (err) {
        error('Failed to toggle enable state:', err);
        // Revert toggle silently
        elements.enableToggle.checked = state.isEnabled;
    }
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
    // Enable/disable toggle
    elements.enableToggle.addEventListener('change', (e) => {
        handleToggleEnable(e.target.checked);
    });
    
    // Available tabs click handler (event delegation)
    elements.availableTabs.addEventListener('click', (e) => {
        const selectButton = e.target.closest('.select-button');
        const tabItem = e.target.closest('.available-tab-item');
        
        if (selectButton && selectButton.dataset.tabId) {
            const tabId = parseInt(selectButton.dataset.tabId);
            handleTabSelection(tabId);
        } else if (tabItem && tabItem.dataset.tabId) {
            const tabId = parseInt(tabItem.dataset.tabId);
            handleTabSelection(tabId);
        }
    });
    
    // Pairs container click handler (event delegation)
    elements.togglePairs.addEventListener('click', (e) => {
        const removeBtn = e.target.closest('.remove-pair-btn');
        if (removeBtn) {
            const tab1Id = removeBtn.dataset.tab1;
            const tab2Id = removeBtn.dataset.tab2;
            if (tab1Id && tab2Id) {
                handlePairRemoval(tab1Id, tab2Id);
            }
        }
    });
    
    // Auto-refresh data every 10 seconds
    setInterval(async () => {
        if (!state.isLoading) {
            try {
                await loadAvailableTabs();
                await loadActivePairs();
                updateStatus('', state.isEnabled ? 'Extension enabled' : 'Extension disabled');
            } catch (err) {
                updateStatus('error', 'Connection error');
            }
        }
    }, 10000);
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Wait for Chrome runtime to be available
 */
async function waitForChromeRuntime(maxWait = 3000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWait) {
        if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
            log('Chrome runtime is ready');
            return true;
        }
        
        log('Waiting for Chrome runtime...');
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    throw new Error('Chrome runtime not available after waiting');
}

/**
 * Retry operation with exponential backoff
 */
async function retryOperation(operation, maxRetries = 3, baseDelay = 200) {
    let lastError;
    
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await operation();
        } catch (err) {
            lastError = err;
            log(`Operation failed (attempt ${i + 1}/${maxRetries}):`, err.message);
            
            if (i < maxRetries - 1) {
                const delay = baseDelay * Math.pow(2, i);
                log(`Retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    
    throw lastError;
}

/**
 * Initialize the popup
 */
async function initialize() {
    try {
        log('Initializing popup');
        
        // Wait for Chrome extension context to be ready
        await waitForChromeRuntime();
        
        // Initialize DOM elements
        initializeElements();
        
        // Set up event listeners
        setupEventListeners();
        
        // Show loading state
        elements.currentTab.innerHTML = `
            <div class="tab-info">
                <span class="tab-title">Loading current tab...</span>
                <span class="tab-url"></span>
            </div>
            <div class="tab-status">
                <span class="status-indicator inactive"></span>
            </div>
        `;
        
        elements.availableTabs.innerHTML = `
            <div class="loading-message">Loading available tabs...</div>
        `;
        
        // Load initial data with retry
        await retryOperation(async () => {
            await Promise.all([
                loadAvailableTabs(),
                loadActivePairs()
            ]);
        }, 3, 500);
        
        // Update status
        updateStatus('', state.isEnabled ? 'Extension enabled' : 'Extension disabled');
        
        log('Popup initialized successfully');
        
    } catch (err) {
        error('Failed to initialize popup:', err);
        updateStatus('error', 'Initialization failed');
        showNotification('Failed to load extension data', 'error');
    }
}

// Start initialization when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    initialize();
}
