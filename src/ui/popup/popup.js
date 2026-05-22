/**
 * TogglePlay Extension - Popup Logic
 * Updated to match new HTML structure with Primary/Secondary tabs
 */

// DOM Elements
const elements = {
    enableToggle: null,
    settingsBtn: null,
    settingsPanel: null,
    exclusiveModeToggle: null,
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
    exclusiveModeEnabled: false,
    isLoading: false
};

let lastRenderSnapshot = '';
let refreshDebounceTimer = null;
let refreshInFlight = null;
const REFRESH_DEBOUNCE_MS = 400;
const REFRESH_INTERVAL_MS = 20000;

const currentTabEls = {
    title: null,
    url: null,
    indicator: null
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
    elements.settingsBtn = document.getElementById('settingsBtn');
    elements.settingsPanel = document.getElementById('settingsPanel');
    elements.exclusiveModeToggle = document.getElementById('exclusiveModeToggle');
    elements.statusIndicator = document.getElementById('statusIndicator');
    elements.statusText = document.getElementById('statusText');
    elements.currentTab = document.getElementById('currentTab');
    elements.availableTabs = document.getElementById('availableTabs');
    elements.togglePairs = document.getElementById('togglePairs');

    currentTabEls.title = elements.currentTab.querySelector('.tab-title');
    currentTabEls.url = elements.currentTab.querySelector('.tab-url');
    currentTabEls.indicator = elements.currentTab.querySelector('.tab-status .status-indicator');
}

function getDisplayHostname(url, sourceType) {
    try {
        return new URL(url).hostname;
    } catch (e) {
        if (sourceType === 'spotify') return 'open.spotify.com';
        if (sourceType === 'ytmusic') return 'music.youtube.com';
        return 'youtube.com';
    }
}

function buildRenderSnapshot() {
    const pair = state.activePairs[0];
    const partner = pair && pair.pairedWith && pair.pairedWith[0];
    return JSON.stringify({
        currentTabId: state.currentTabId,
        currentTitle: state._currentTabTitle || '',
        currentHost: state._currentTabHost || '',
        currentHasMedia: !!state._currentHasMedia,
        tabs: state.availableTabs.map(function (t) {
            return [t.id, t.title, t.url, t.webPlayerActive === false];
        }),
        pair: pair ? [pair.tabId, pair.title, partner && partner.tabId, partner && partner.title] : null,
        isEnabled: state.isEnabled,
        exclusive: state.exclusiveModeEnabled,
        selectedTabId: state.selectedTabId
    });
}

function syncSelectedFromPairs() {
    const pair = state.activePairs[0];
    if (pair && pair.pairedWith && pair.pairedWith.length > 0) {
        state.selectedTabId = pair.pairedWith[0].tabId;
    } else {
        state.selectedTabId = null;
    }
}

function syncControls() {
    if (elements.enableToggle.checked !== state.isEnabled) {
        elements.enableToggle.checked = state.isEnabled;
    }
    if (elements.exclusiveModeToggle &&
        elements.exclusiveModeToggle.checked !== state.exclusiveModeEnabled) {
        elements.exclusiveModeToggle.checked = state.exclusiveModeEnabled;
    }
}

function renderAllIfChanged() {
    const snapshot = buildRenderSnapshot();
    if (snapshot === lastRenderSnapshot) {
        return false;
    }
    lastRenderSnapshot = snapshot;
    renderCurrentTab();
    renderAvailableTabs();
    renderActivePairs();
    syncControls();
    return true;
}

function scheduleRefresh(delay) {
    if (refreshDebounceTimer) {
        clearTimeout(refreshDebounceTimer);
    }
    refreshDebounceTimer = setTimeout(function () {
        refreshDebounceTimer = null;
        refreshPopupData();
    }, delay == null ? REFRESH_DEBOUNCE_MS : delay);
}

async function refreshPopupData() {
    if (refreshInFlight) {
        return refreshInFlight;
    }

    refreshInFlight = (async function () {
        try {
            const [tabsResponse, pairsResponse, currentTab] = await Promise.all([
                sendMessage({ type: TogglePlayMessages.GET_TABS }),
                sendMessage({ type: TogglePlayMessages.GET_PAIRS }),
                getCurrentTab()
            ]);

            state.availableTabs = tabsResponse.tabs || [];
            state.currentTabId = currentTab && currentTab.id;
            state.availableTabs = state.availableTabs.filter(function (tab) {
                return tab.id !== state.currentTabId;
            });

            state.activePairs = pairsResponse.pairs || [];
            state.isEnabled = pairsResponse.isEnabled !== false;
            state.exclusiveModeEnabled = pairsResponse.exclusiveModeEnabled === true;
            syncSelectedFromPairs();

            state._currentTabRef = currentTab;
            renderAllIfChanged();

            const statusMsg = state.isEnabled ? 'Extension enabled' : 'Extension disabled';
            if (elements.statusText.textContent !== statusMsg) {
                updateStatus('', statusMsg);
            }
        } catch (err) {
            error('Refresh failed:', err);
            if (err.message && !err.message.includes('Chrome runtime not available')) {
                updateStatus('error', 'Connection error');
            }
        }
    })();

    try {
        return await refreshInFlight;
    } finally {
        refreshInFlight = null;
    }
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
    const cls = status ? 'status-dot ' + status : 'status-dot';
    if (elements.statusIndicator.className !== cls) {
        elements.statusIndicator.className = cls;
    }
    if (elements.statusText.textContent !== message) {
        elements.statusText.textContent = message;
    }
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
        
        const response = await chrome.runtime.sendMessage(message);
        
        if (chrome.runtime.lastError) {
            throw new Error(chrome.runtime.lastError.message);
        }
        
        if (response && response.success === false && response.error) {
            throw new Error(response.error);
        }
        
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
 * Render current tab in place (no innerHTML — avoids layout flash).
 */
function renderCurrentTab() {
    const container = elements.currentTab;
    const tab = state._currentTabRef;

    if (!tab || !tab.url || !TogglePlayPlatforms.isMediaUrl(tab.url)) {
        state._currentHasMedia = false;
        state._currentTabTitle = 'No media tab active';
        state._currentTabHost = 'Navigate to YouTube, YouTube Music, or Spotify';
        container.classList.toggle('has-media', false);
        if (currentTabEls.title.textContent !== state._currentTabTitle) {
            currentTabEls.title.textContent = state._currentTabTitle;
        }
        if (currentTabEls.url.textContent !== state._currentTabHost) {
            currentTabEls.url.textContent = state._currentTabHost;
        }
        currentTabEls.indicator.className = 'status-indicator inactive';
        return;
    }

    const sourceType = TogglePlayPlatforms.getSourceType(tab.url);
    const icon = TogglePlayPlatforms.getSourceIcon(sourceType);
    state._currentHasMedia = true;
    state._currentTabTitle = icon + ' ' + (tab.title || 'Media');
    state._currentTabHost = getDisplayHostname(tab.url, sourceType);

    container.classList.toggle('has-media', true);
    if (currentTabEls.title.textContent !== state._currentTabTitle) {
        currentTabEls.title.textContent = state._currentTabTitle;
    }
    if (currentTabEls.url.textContent !== state._currentTabHost) {
        currentTabEls.url.textContent = state._currentTabHost;
    }
    currentTabEls.indicator.className = 'status-indicator active';
}

function createAvailableTabRow(tab) {
    const sourceType = tab.sourceType || TogglePlayPlatforms.getSourceType(tab.url);
    const row = document.createElement('div');
    row.className = 'available-tab-item';
    row.dataset.tabId = String(tab.id);

    const info = document.createElement('div');
    info.className = 'available-tab-info';

    const titleEl = document.createElement('span');
    titleEl.className = 'available-tab-title';
    info.appendChild(titleEl);

    const urlEl = document.createElement('span');
    urlEl.className = 'available-tab-url';
    info.appendChild(urlEl);

    row.appendChild(info);

    const btn = document.createElement('button');
    btn.className = 'select-button';
    btn.type = 'button';
    btn.dataset.tabId = String(tab.id);
    row.appendChild(btn);

    return row;
}

function updateAvailableTabRow(row, tab) {
    const sourceType = tab.sourceType || TogglePlayPlatforms.getSourceType(tab.url);
    const icon = TogglePlayPlatforms.getSourceIcon(sourceType);
    const title = icon + ' ' + (tab.title || 'Media');
    const host = getDisplayHostname(tab.url, sourceType);
    const isSelected = tab.id === state.selectedTabId;

    row.classList.toggle('selected', isSelected);

    const titleEl = row.querySelector('.available-tab-title');
    const urlEl = row.querySelector('.available-tab-url');
    const btn = row.querySelector('.select-button');

    if (titleEl.textContent !== title) titleEl.textContent = title;
    if (urlEl.textContent !== host) urlEl.textContent = host;
    if (btn.textContent !== (isSelected ? 'Selected' : 'Select')) {
        btn.textContent = isSelected ? 'Selected' : 'Select';
    }

    let warning = row.querySelector('.spotify-device-warning');
    const showWarning = tab.sourceType === 'spotify' && tab.webPlayerActive === false;
    if (showWarning && !warning) {
        warning = document.createElement('div');
        warning.className = 'spotify-device-warning';
        warning.textContent = 'Web player not active — playback is on another device';
        row.querySelector('.available-tab-info').appendChild(warning);
    } else if (!showWarning && warning) {
        warning.remove();
    }
}

/**
 * Render available tabs with in-place diff (no full list rebuild).
 */
function renderAvailableTabs() {
    const container = elements.availableTabs;
    const emptyMsg = 'No other YouTube, YouTube Music, or Spotify tabs found';

    if (state.availableTabs.length === 0) {
        if (container.querySelector('.no-available-tabs')) {
            return;
        }
        container.replaceChildren();
        const empty = document.createElement('div');
        empty.className = 'no-available-tabs';
        empty.textContent = emptyMsg;
        container.appendChild(empty);
        return;
    }

    const placeholder = container.querySelector('.no-available-tabs, .loading-message');
    if (placeholder) placeholder.remove();

    const seen = new Set();
    state.availableTabs.forEach(function (tab) {
        let row = container.querySelector('.available-tab-item[data-tab-id="' + tab.id + '"]');
        if (!row) {
            row = createAvailableTabRow(tab);
            container.appendChild(row);
        }
        updateAvailableTabRow(row, tab);
        seen.add(String(tab.id));
    });

    container.querySelectorAll('.available-tab-item').forEach(function (row) {
        if (!seen.has(row.dataset.tabId)) {
            row.remove();
        }
    });
}

function renderActivePairs() {
    const container = elements.togglePairs;
    const emptyMsg = 'No active pair configured';
    const firstPair = state.activePairs[0];
    const pairedTab = firstPair && firstPair.pairedWith && firstPair.pairedWith[0];

    if (!pairedTab) {
        if (container.querySelector('.no-pairs')) {
            return;
        }
        container.replaceChildren();
        const empty = document.createElement('div');
        empty.className = 'no-pairs';
        empty.textContent = emptyMsg;
        container.appendChild(empty);
        return;
    }

    const emptyEl = container.querySelector('.no-pairs');
    if (emptyEl) emptyEl.remove();

    let item = container.querySelector('.pair-item');
    if (!item) {
        item = document.createElement('div');
        item.className = 'pair-item';
        item.innerHTML =
            '<div class="pair-tabs">' +
            '<div class="pair-tab"><div class="pair-tab-title"></div><div class="pair-tab-url"></div></div>' +
            '<div class="pair-arrow">↔</div>' +
            '<div class="pair-tab"><div class="pair-tab-title"></div><div class="pair-tab-url"></div></div>' +
            '</div>' +
            '<button type="button" class="remove-pair-btn">×</button>';
        container.appendChild(item);
    }

    const icon1 = TogglePlayPlatforms.getSourceIcon(
        firstPair.sourceType || TogglePlayPlatforms.getSourceType(firstPair.url)
    );
    const icon2 = TogglePlayPlatforms.getSourceIcon(
        pairedTab.sourceType || TogglePlayPlatforms.getSourceType(pairedTab.url)
    );
    const t1 = icon1 + ' ' + (firstPair.title || 'Media');
    const t2 = icon2 + ' ' + (pairedTab.title || 'Media');
    const u1 = 'Tab ' + firstPair.tabId;
    const u2 = 'Tab ' + pairedTab.tabId;

    const titles = item.querySelectorAll('.pair-tab-title');
    const urls = item.querySelectorAll('.pair-tab-url');
    const removeBtn = item.querySelector('.remove-pair-btn');

    if (titles[0].textContent !== t1) titles[0].textContent = t1;
    if (urls[0].textContent !== u1) urls[0].textContent = u1;
    if (titles[1].textContent !== t2) titles[1].textContent = t2;
    if (urls[1].textContent !== u2) urls[1].textContent = u2;

    removeBtn.dataset.tab1 = String(firstPair.tabId);
    removeBtn.dataset.tab2 = String(pairedTab.tabId);
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
        lastRenderSnapshot = '';
        renderAllIfChanged();
        return;
    }
    
    // Always create/replace pair - no selection state needed
    try {
        log('Creating/replacing pair between tabs:', state.currentTabId, tabId);
        
        // Send ADD_PAIR which will automatically clear existing pairs and create new one
        const response = await sendMessage({
            type: TogglePlayMessages.ADD_PAIR,
            tabId1: state.currentTabId,
            tabId2: tabId
        });
        
        if (response && response.success !== false) {
            // Auto-enable silently if not enabled
            if (!state.isEnabled) {
                await sendMessage({ type: TogglePlayMessages.SET_ENABLED, enabled: true });
                state.isEnabled = true;
                elements.enableToggle.checked = true;
            }
            
            lastRenderSnapshot = '';
            await refreshPopupData();
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
            type: TogglePlayMessages.CLEAR_ALL_PAIRS
        });
        
        if (response && response.success !== false) {
            log('All pairs removed successfully');
        } else {
            error('Failed to remove all pairs:', response?.error);
        }
        
        lastRenderSnapshot = '';
        await refreshPopupData();
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
            type: TogglePlayMessages.REMOVE_PAIR,
            tabId1: parseInt(tab1Id),
            tabId2: parseInt(tab2Id)
        });
        
        if (response && response.success !== false) {
            showNotification('Pair removed successfully', 'success');
            lastRenderSnapshot = '';
            await refreshPopupData();
        } else {
            throw new Error(response?.error || 'Failed to remove pair');
        }
    } catch (err) {
        error('Failed to remove pair:', err);
        showNotification('Failed to remove pair: ' + err.message, 'error');
    }
}

function setSettingsPanelOpen(open) {
    if (!elements.settingsPanel || !elements.settingsBtn) return;
    elements.settingsPanel.hidden = !open;
    elements.settingsBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    elements.settingsBtn.classList.toggle('is-open', open);
}

async function handleExclusiveModeChange(enabled) {
    try {
        const response = await sendMessage({
            type: TogglePlayMessages.SET_EXCLUSIVE_MODE,
            enabled: enabled
        });

        if (response && response.success !== false) {
            state.exclusiveModeEnabled = enabled;
            lastRenderSnapshot = '';
            syncControls();
        } else {
            syncControls();
        }
    } catch (err) {
        error('Failed to set exclusive mode:', err);
        syncControls();
    }
}

/**
 * Handle enable/disable toggle
 */
async function handleToggleEnable(enabled) {
    try {
        log('Toggling enable state to:', enabled);
        
        const response = await sendMessage({
            type: TogglePlayMessages.SET_ENABLED,
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

    if (elements.settingsBtn && elements.settingsPanel) {
        elements.settingsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = elements.settingsBtn.getAttribute('aria-expanded') === 'true';
            setSettingsPanelOpen(!isOpen);
        });

        document.addEventListener('click', (e) => {
            if (!elements.settingsPanel.hidden &&
                !e.target.closest('.settings-wrapper') &&
                !e.target.closest('#settingsPanel')) {
                setSettingsPanelOpen(false);
            }
        });
    }

    if (elements.exclusiveModeToggle) {
        elements.exclusiveModeToggle.addEventListener('change', (e) => {
            handleExclusiveModeChange(e.target.checked);
        });
    }

    const downloadLogsLink = document.getElementById('downloadLogsLink');
    if (downloadLogsLink) {
        downloadLogsLink.addEventListener('click', async (e) => {
            e.preventDefault();
            try {
                const response = await sendMessage({ type: TogglePlayMessages.GET_LOGS });
                if (response && response.success && response.logs) {
                    const blob = new Blob([response.logs.join('\n')], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'toggleplay-logs.txt';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    showNotification('Logs downloaded', 'success');
                } else {
                    showNotification('Failed to get logs', 'error');
                }
            } catch (err) {
                showNotification('Error downloading logs', 'error');
            }
        });
    }
    
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
    
    setInterval(function () {
        if (!state.isLoading) {
            scheduleRefresh(0);
        }
    }, REFRESH_INTERVAL_MS);

    if (chrome.runtime && chrome.runtime.onMessage) {
        chrome.runtime.onMessage.addListener(function (msg) {
            if (msg.type === 'PAIRS_UPDATED' || msg.type === 'TABS_UPDATED') {
                scheduleRefresh();
            }
        });
    }
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
        
        if (currentTabEls.title) {
            currentTabEls.title.textContent = 'Loading current tab...';
        }
        if (currentTabEls.url) {
            currentTabEls.url.textContent = '';
        }

        elements.availableTabs.replaceChildren();
        const loading = document.createElement('div');
        loading.className = 'loading-message';
        loading.textContent = 'Loading available tabs...';
        elements.availableTabs.appendChild(loading);

        await retryOperation(function () {
            return refreshPopupData();
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
