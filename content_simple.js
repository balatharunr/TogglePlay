/**
 * TogglePlay Extension - Simplified Content Script for Debugging
 */

(() => {
    'use strict';

    let state = {
        tabId: null,
        isPlaying: false,
        debounceTimer: null,
        currentVideo: null,
        connected: false
    };

    function log(message, ...args) {
        console.log(`[TogglePlay Content SIMPLE-${state.tabId || 'unknown'}]`, message, ...args);
    }

    function error(message, ...args) {
        console.error(`[TogglePlay Content SIMPLE-${state.tabId || 'unknown'}]`, message, ...args);
    }

    /**
     * Get tab ID
     */
    async function initializeTabId() {
        try {
            const response = await chrome.runtime.sendMessage({ type: 'GET_TAB_ID' });
            if (response?.tabId) {
                state.tabId = response.tabId;
                state.connected = true;
                log('Tab ID initialized:', state.tabId);
                return true;
            }
        } catch (err) {
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
        try {
            const response = await chrome.runtime.sendMessage({
                ...message,
                tabId: state.tabId
            });
            return response;
        } catch (err) {
            error('Failed to send message:', err);
            throw err;
        }
    }

    /**
     * Notify state change (debounced)
     */
    function notifyStateChange(newState) {
        if (state.debounceTimer) {
            clearTimeout(state.debounceTimer);
        }

        state.debounceTimer = setTimeout(async () => {
            if (state.isPlaying !== newState) {
                state.isPlaying = newState;
                log('State change:', newState ? 'PLAYING' : 'PAUSED');
                
                try {
                    await sendMessage({
                        type: 'PLAYBACK_STATE_CHANGED',
                        isPlaying: newState
                    });
                } catch (err) {
                    error('Failed to notify state change:', err);
                }
            }
        }, 300);
    }

    /**
     * Set up video listeners
     */
    function setupVideoListeners(video) {
        if (!video || video.hasSimpleToggleListeners) return;

        log('Setting up simple video listeners');

        ['play', 'pause', 'ended'].forEach(eventType => {
            video.addEventListener(eventType, () => {
                const isPlaying = getPlaybackState(video);
                log(`Video event: ${eventType}, isPlaying: ${isPlaying}`);
                notifyStateChange(isPlaying);
            });
        });

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
        const video = findVideoElement();
        if (video && video !== state.currentVideo) {
            log('New video found, setting up listeners');
            setupVideoListeners(video);
        }
    }

    /**
     * Initialize
     */
    async function initialize() {
        try {
            log('Initializing simple content script');
            
            await initializeTabId();
            
            // Check for video every 2 seconds
            setInterval(checkForVideo, 2000);
            
            // Initial check
            setTimeout(checkForVideo, 1000);
            
            log('Simple content script initialized');
        } catch (err) {
            error('Failed to initialize:', err);
        }
    }

    initialize();
})();
