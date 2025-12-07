/**
 * TogglePlay Extension - Content Script
 * Detects and controls YouTube video playback
 */

(() => {
    'use strict';

    let state = {
        tabId: null,
        isPlaying: false,
        debounceTimer: null,
        currentVideo: null,
        connected: false,
        contextValid: true
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
        console.log(`[TogglePlay Content-${state.tabId || 'unknown'}]`, message, ...args);
    }

    function error(message, ...args) {
        if (!state.contextValid || !isContextValid()) {
            state.contextValid = false;
            return;
        }
        console.error(`[TogglePlay Content-${state.tabId || 'unknown'}]`, message, ...args);
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
            // Silently fail if context is invalidated
            if (err.message?.includes('Extension context invalidated')) {
                state.contextValid = false;
                return false;
            }
            error('Failed to get tab ID:', err);
        }
        return false;
    }

    /**
     * Find video element
     */
    function findVideoElement() {
        const video = document.querySelector('video');
        return video && video.readyState >= 1 && video.duration > 0 ? video : null;
    }

    /**
     * Get playback state
     */
    function getPlaybackState(video) {
        if (!video) return false;
        return !video.paused && !video.ended && video.currentTime > 0;
    }

    /**
     * Send message to background
     */
    async function sendMessage(message) {
        // Check if context is still valid
        if (!isContextValid()) {
            state.contextValid = false;
            return null;
        }
        
        try {
            const response = await chrome.runtime.sendMessage({
                ...message,
                tabId: state.tabId
            });
            return response;
        } catch (err) {
            // Check if this is a context invalidation error
            if (err.message?.includes('Extension context invalidated') || 
                err.message?.includes('disconnected')) {
                state.contextValid = false;
            }
            // Silently ignore connection errors - these are expected when extension reloads
            return null;
        }
    }

    /**
     * Notify state change (debounced)
     */
    function notifyStateChange(newState) {
        // Don't notify if context is invalid
        if (!isContextValid()) {
            state.contextValid = false;
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
            
            // Always update and notify (removed the !== check that was blocking repeated states)
            state.isPlaying = newState;
            log('Notifying state change:', newState ? 'PLAYING' : 'PAUSED');
            
            await sendMessage({
                type: 'PLAYBACK_STATE_CHANGED',
                isPlaying: newState
            });
        }, 300);
    }

    /**
     * Set up video listeners
     */
    function setupVideoListeners(video) {
        if (!video) return;
        
        // Use a unique key for this script instance to avoid conflicts with old listeners
        const listenerKey = `togglePlayListeners_${Date.now()}`;
        
        // Remove old listener flag if exists (from previous extension context)
        if (video.hasSimpleToggleListeners && !video[listenerKey]) {
            log('Detected old listeners, setting up fresh ones');
        }

        if (video[listenerKey]) return; // Already set up by THIS instance

        log('Setting up video listeners');

        ['play', 'pause', 'ended'].forEach(eventType => {
            video.addEventListener(eventType, () => {
                // Always check context before processing
                if (!isContextValid()) {
                    state.contextValid = false;
                    return;
                }
                const isPlaying = getPlaybackState(video);
                log(`Video event: ${eventType}, isPlaying: ${isPlaying}`);
                notifyStateChange(isPlaying);
            });
        });

        video[listenerKey] = true;
        video.hasSimpleToggleListeners = true;
        state.currentVideo = video;
        
        // Send initial state
        const initialState = getPlaybackState(video);
        notifyStateChange(initialState);
    }

    /**
     * Control playback
     */
    async function controlPlayback(action) {
        const video = findVideoElement();
        if (!video) {
            throw new Error('No video element found');
        }

        log(`Control request: ${action}`);

        try {
            if (action === 'PLAY') {
                await video.play();
                log('Play executed');
            } else if (action === 'PAUSE') {
                video.pause();
                log('Pause executed');
            }
        } catch (err) {
            error(`Failed to ${action}:`, err);
            throw err;
        }
    }

    /**
     * Message listener
     */
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        log('Received message:', message.type);

        const handleAsync = async () => {
            try {
                switch (message.type) {
                    case 'CONTROL_PLAYBACK':
                        await controlPlayback(message.action);
                        return { success: true };

                    case 'GET_PLAYBACK_STATE':
                        const video = findVideoElement();
                        const isPlaying = getPlaybackState(video);
                        return { success: true, isPlaying, hasVideo: !!video };

                    case 'PING':
                        return { success: true };

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

    /**
     * Check for video periodically
     */
    function checkForVideo() {
        // Stop checking if context is invalid
        if (!isContextValid()) {
            state.contextValid = false;
            return;
        }
        
        const video = findVideoElement();
        if (video && video !== state.currentVideo) {
            log('New video found, setting up listeners');
            setupVideoListeners(video);
        }
    }

    /**
     * Handle keyboard shortcuts
     */
    function setupKeyboardShortcuts() {
        // Use capture phase to intercept before YouTube handles it
        document.addEventListener('keydown', async (event) => {
            // Check if context is still valid
            if (!isContextValid()) {
                state.contextValid = false;
                return;
            }
            
            // Check if B key is pressed (not in an input field)
            if (event.key.toLowerCase() === 'b' && 
                !event.ctrlKey && !event.altKey && !event.metaKey &&
                !['INPUT', 'TEXTAREA'].includes(event.target.tagName) &&
                !event.target.isContentEditable) {
                
                // Prevent YouTube's default B key behavior
                event.preventDefault();
                event.stopPropagation();
                
                log('B key pressed - pausing both tabs');
                
                // First, pause the current tab's video directly
                const video = findVideoElement();
                if (video && !video.paused) {
                    video.pause();
                    log('Paused current tab video directly');
                }
                
                try {
                    const response = await sendMessage({ type: 'PAUSE_BOTH' });
                    if (response?.success) {
                        log('Both tabs paused successfully');
                    } else {
                        log('Failed to pause both tabs:', response?.error);
                    }
                } catch (err) {
                    error('Error pausing both tabs:', err);
                }
            }
        }, true); // Use capture phase
        
        log('Keyboard shortcuts set up');
    }

    /**
     * Initialize
     */
    async function initialize() {
        try {
            log('Initializing content script');
            
            await initializeTabId();
            
            // Set up keyboard shortcuts
            setupKeyboardShortcuts();
            
            // Check for video every 2 seconds, but stop if context becomes invalid
            const intervalId = setInterval(() => {
                if (!isContextValid()) {
                    state.contextValid = false;
                    clearInterval(intervalId);
                    return;
                }
                checkForVideo();
            }, 2000);
            
            // Initial check
            setTimeout(checkForVideo, 1000);
            
            log('Content script initialized');
        } catch (err) {
            error('Failed to initialize:', err);
        }
    }

    initialize();
})();
