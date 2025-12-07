/**
 * TogglePlay Extension - Spotify Content Script
 * Detects and controls Spotify web player playback
 * 
 * IMPORTANT LIMITATIONS:
 * - Spotify Web Player must be the ACTIVE DEVICE (not controlling phone/desktop app)
 * - User must have started playback at least once for controls to work
 * - Spotify uses Encrypted Media Extensions, so we can't directly access audio
 * 
 * This script uses keyboard simulation (spacebar) which is Spotify's native shortcut
 */

(() => {
    'use strict';

    let state = {
        tabId: null,
        isPlaying: false,
        debounceTimer: null,
        observer: null,
        connected: false,
        contextValid: true,
        lastKnownState: null,
        playerReady: false
    };

    /**
     * Check if extension context is still valid
     */
    function isContextValid() {
        try {
            return !!(chrome.runtime && chrome.runtime.id);
        } catch (e) {
            return false;
        }
    }

    function log(message, ...args) {
        if (!state.contextValid || !isContextValid()) {
            state.contextValid = false;
            return;
        }
        console.log(`[TogglePlay Spotify-${state.tabId || 'unknown'}]`, message, ...args);
    }

    function error(message, ...args) {
        if (!state.contextValid || !isContextValid()) {
            state.contextValid = false;
            return;
        }
        console.error(`[TogglePlay Spotify-${state.tabId || 'unknown'}]`, message, ...args);
    }

    /**
     * Get tab ID
     */
    async function initializeTabId() {
        if (!isContextValid()) {
            state.contextValid = false;
            return false;
        }
        
        try {
            const response = await chrome.runtime.sendMessage({ type: 'GET_TAB_ID' });
            if (response?.tabId) {
                state.tabId = response.tabId;
                state.connected = true;
                log('Tab ID initialized:', state.tabId);
                return true;
            }
        } catch (err) {
            if (err.message?.includes('Extension context invalidated')) {
                state.contextValid = false;
                return false;
            }
            error('Failed to get tab ID:', err);
        }
        return false;
    }

    /**
     * Find the play/pause button in Spotify web player
     */
    function findPlayPauseButton() {
        const selectors = [
            'button[data-testid="control-button-playpause"]',
            '[data-testid="control-button-playpause"]',
            'button[aria-label="Pause"]',
            'button[aria-label="Play"]',
            '.player-controls button[aria-label="Pause"]',
            '.player-controls button[aria-label="Play"]'
        ];
        
        for (const selector of selectors) {
            const button = document.querySelector(selector);
            if (button) {
                return button;
            }
        }
        
        return null;
    }

    /**
     * Check if web player is the active device
     * If Spotify is controlling another device, our controls won't work
     */
    function isWebPlayerActive() {
        // Look for "Listening on" indicator which shows when controlling another device
        const connectBar = document.querySelector('[data-testid="device-picker-button"]');
        if (connectBar) {
            const text = connectBar.textContent || connectBar.innerText || '';
            // If it shows a device name, web player might not be active
            log('Device picker text:', text);
        }
        
        // Check if there's an active now-playing bar
        const nowPlaying = document.querySelector('[data-testid="now-playing-bar"]') ||
                          document.querySelector('[data-testid="now-playing-widget"]') ||
                          document.querySelector('.now-playing-bar');
        
        return !!nowPlaying;
    }

    /**
     * Get playback state from Spotify
     */
    function getPlaybackState() {
        const button = findPlayPauseButton();
        if (!button) {
            log('No play/pause button found');
            return false;
        }
        
        // Check aria-label - "Pause" means currently playing, "Play" means paused
        const ariaLabel = button.getAttribute('aria-label')?.toLowerCase() || '';
        
        if (ariaLabel.includes('pause')) {
            return true; // Shows "Pause" button = music is playing
        }
        if (ariaLabel.includes('play')) {
            return false; // Shows "Play" button = music is paused
        }
        
        // Fallback: check the SVG inside the button
        // Pause icon = 2 rectangles, Play icon = triangle
        const svg = button.querySelector('svg');
        if (svg) {
            const rects = svg.querySelectorAll('rect');
            if (rects.length >= 2) {
                return true; // Pause icon (two bars)
            }
            const polygons = svg.querySelectorAll('polygon');
            if (polygons.length > 0) {
                return false; // Play icon (triangle)
            }
        }
        
        return false;
    }

    /**
     * Send message to background
     */
    async function sendMessage(message) {
        if (!isContextValid()) {
            state.contextValid = false;
            return null;
        }
        
        try {
            const response = await chrome.runtime.sendMessage({
                ...message,
                tabId: state.tabId,
                source: 'spotify'
            });
            return response;
        } catch (err) {
            if (err.message?.includes('Extension context invalidated') || 
                err.message?.includes('disconnected')) {
                state.contextValid = false;
            }
            return null;
        }
    }

    /**
     * Notify state change (debounced)
     */
    function notifyStateChange(newState) {
        if (!isContextValid()) {
            state.contextValid = false;
            return;
        }
        
        // Only notify if state actually changed
        if (state.isPlaying === newState) {
            return;
        }
        
        if (state.debounceTimer) {
            clearTimeout(state.debounceTimer);
        }

        state.debounceTimer = setTimeout(async () => {
            if (!isContextValid()) {
                state.contextValid = false;
                return;
            }
            
            state.isPlaying = newState;
            log('Notifying state change:', newState ? 'PLAYING' : 'PAUSED');
            
            await sendMessage({
                type: 'PLAYBACK_STATE_CHANGED',
                isPlaying: newState
            });
        }, 300);
    }

    /**
     * Control playback by clicking the button
     */
    function controlPlayback(action) {
        log(`Control request: ${action}`);
        
        const button = findPlayPauseButton();
        if (!button) {
            log('ERROR: No play/pause button found - is Spotify player loaded?');
            return;
        }
        
        const isCurrentlyPlaying = getPlaybackState();
        log(`Currently playing: ${isCurrentlyPlaying}, requested action: ${action}`);
        
        // Only click if we need to change state
        if (action === 'PLAY' && !isCurrentlyPlaying) {
            log('Clicking to PLAY');
            button.click();
        } else if (action === 'PAUSE' && isCurrentlyPlaying) {
            log('Clicking to PAUSE');
            button.click();
        } else {
            log('No action needed - already in desired state');
        }
    }

    /**
     * Set up observer to watch for play state changes
     */
    function setupPlayStateObserver() {
        if (state.observer) {
            state.observer.disconnect();
        }

        // Watch for button changes
        const observeTarget = document.querySelector('[data-testid="now-playing-bar"]') ||
                             document.querySelector('.now-playing-bar') ||
                             document.body;

        state.observer = new MutationObserver(() => {
            if (!isContextValid()) {
                state.contextValid = false;
                state.observer?.disconnect();
                return;
            }
            
            const isPlaying = getPlaybackState();
            if (isPlaying !== state.lastKnownState) {
                log('Observer detected state change:', isPlaying ? 'PLAYING' : 'PAUSED');
                state.lastKnownState = isPlaying;
                notifyStateChange(isPlaying);
            }
        });

        state.observer.observe(observeTarget, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['aria-label', 'class']
        });

        log('Observer watching:', observeTarget.className || observeTarget.tagName);
        
        // Also poll every 500ms as backup since Spotify's DOM can be tricky
        const pollInterval = setInterval(() => {
            if (!isContextValid()) {
                clearInterval(pollInterval);
                return;
            }
            
            const isPlaying = getPlaybackState();
            if (isPlaying !== state.lastKnownState) {
                log('Polling detected state change:', isPlaying ? 'PLAYING' : 'PAUSED');
                state.lastKnownState = isPlaying;
                notifyStateChange(isPlaying);
            }
        }, 500);
        
        // Initial state
        const initialState = getPlaybackState();
        state.lastKnownState = initialState;
        state.isPlaying = initialState;
        log('Initial state:', initialState ? 'PLAYING' : 'PAUSED');
        notifyStateChange(initialState);
    }

    /**
     * Message listener
     */
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        log('Received message:', message.type);

        try {
            switch (message.type) {
                case 'CONTROL_PLAYBACK':
                    controlPlayback(message.action);
                    sendResponse({ success: true });
                    break;

                case 'GET_PLAYBACK_STATE':
                    const isPlaying = getPlaybackState();
                    const hasPlayer = !!findPlayPauseButton();
                    sendResponse({ success: true, isPlaying, hasPlayer });
                    break;

                case 'PING':
                    sendResponse({ success: true });
                    break;

                default:
                    sendResponse({ success: false, error: 'Unknown message type' });
            }
        } catch (err) {
            error('Error handling message:', err);
            sendResponse({ success: false, error: err.message });
        }

        return true;
    });

    /**
     * Wait for Spotify player to be ready
     */
    function waitForPlayer() {
        let attempts = 0;
        const maxAttempts = 60; // Wait up to 60 seconds
        
        const checkInterval = setInterval(() => {
            if (!isContextValid()) {
                state.contextValid = false;
                clearInterval(checkInterval);
                return;
            }
            
            attempts++;
            const button = findPlayPauseButton();
            
            if (button) {
                log('✓ Spotify player ready after', attempts, 'seconds');
                state.playerReady = true;
                clearInterval(checkInterval);
                setupPlayStateObserver();
            } else if (attempts >= maxAttempts) {
                log('✗ Spotify player not found after', maxAttempts, 'seconds');
                log('Make sure to play a song first to activate the player');
                clearInterval(checkInterval);
            } else if (attempts % 10 === 0) {
                log('Waiting for Spotify player...', attempts, 'seconds');
            }
        }, 1000);
    }

    /**
     * Handle keyboard shortcuts
     */
    function setupKeyboardShortcuts() {
        document.addEventListener('keydown', async (event) => {
            if (!isContextValid()) {
                state.contextValid = false;
                return;
            }
            
            // Check if B key is pressed (not in an input field)
            if (event.key.toLowerCase() === 'b' && 
                !event.ctrlKey && !event.altKey && !event.metaKey &&
                !['INPUT', 'TEXTAREA', 'SEARCH'].includes(event.target.tagName) &&
                !event.target.isContentEditable &&
                !event.target.getAttribute('role')?.includes('search')) {
                
                event.preventDefault();
                event.stopPropagation();
                
                log('B key pressed - pausing both tabs');
                controlPlayback('PAUSE');
                
                try {
                    await sendMessage({ type: 'PAUSE_BOTH' });
                } catch (err) {
                    error('Error pausing both tabs:', err);
                }
            }
        }, true);
        
        log('Keyboard shortcuts ready (press B to pause both)');
    }

    /**
     * Initialize
     */
    async function initialize() {
        try {
            log('=== TogglePlay Spotify Extension ===');
            log('URL:', window.location.href);
            
            await initializeTabId();
            setupKeyboardShortcuts();
            
            // Give Spotify a moment to load
            setTimeout(waitForPlayer, 1500);
            
            log('Initialization complete');
            log('TIP: Make sure to start playing a song for the controls to appear');
        } catch (err) {
            error('Failed to initialize:', err);
        }
    }

    // Start when document is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
})();
