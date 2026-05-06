/**
 * TogglePlay Extension - YouTube Music Content Script
 * Detects and controls YouTube Music playback
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
        console.log(`[TogglePlay YTMusic-${state.tabId || 'unknown'}]`, message, ...args);
    }

    function error(message, ...args) {
        if (!state.contextValid || !isContextValid()) {
            state.contextValid = false;
            return;
        }
        console.error(`[TogglePlay YTMusic-${state.tabId || 'unknown'}]`, message, ...args);
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
     * Find video element (YouTube Music uses video element for audio playback)
     */
    function findVideoElement() {
        // YouTube Music uses a video element for audio playback
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
     * Find the play/pause button in YouTube Music
     */
    function findPlayPauseButton() {
        const selectors = [
            '#play-pause-button',
            'tp-yt-paper-icon-button#play-pause-button',
            '.ytmusic-player-bar #play-pause-button',
            '[aria-label="Play"]',
            '[aria-label="Pause"]'
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
                tabId: state.tabId,
                source: 'ytmusic'
            });
            return response;
        } catch (err) {
            // Silently fail if context is invalidated
            if (err.message?.includes('Extension context invalidated')) {
                state.contextValid = false;
                return null;
            }
            error('Send message failed:', err);
            return null;
        }
    }

    /**
     * Notify background of playback state change
     */
    function notifyPlaybackChange(isPlaying, force = false) {
        // Clear any pending debounce
        if (state.debounceTimer) {
            clearTimeout(state.debounceTimer);
        }
        
        // Debounce to avoid rapid state changes
        state.debounceTimer = setTimeout(async () => {
            if (force || state.isPlaying !== isPlaying) {
                state.isPlaying = isPlaying;
                log('Playback state changed:', isPlaying ? 'PLAYING' : 'PAUSED');
                
                await sendMessage({
                    type: 'PLAYBACK_STATE_CHANGED',
                    isPlaying: isPlaying
                });
            }
        }, 150);
    }

    /**
     * Control playback
     */
    function controlPlayback(action) {
        log('Controlling playback:', action);
        
        const video = findVideoElement();
        
        if (video) {
            if (action === 'PLAY') {
                video.play().catch(err => {
                    log('Play failed, trying button click:', err.message);
                    clickPlayPauseButton();
                });
            } else if (action === 'PAUSE') {
                video.pause();
            } else if (action === 'TOGGLE') {
                if (video.paused) {
                    video.play().catch(err => {
                        log('Play failed, trying button click:', err.message);
                        clickPlayPauseButton();
                    });
                } else {
                    video.pause();
                }
            }
            return;
        }
        
        // Fallback to button click
        clickPlayPauseButton();
    }

    /**
     * Click play/pause button as fallback
     */
    function clickPlayPauseButton() {
        const button = findPlayPauseButton();
        if (button) {
            log('Clicking play/pause button');
            button.click();
        } else {
            log('Play/pause button not found');
        }
    }

    /**
     * Set up video event listeners
     */
    function setupVideoListeners(video) {
        if (state.currentVideo === video) {
            return; // Already set up
        }
        
        // Remove listeners from previous video if any
        if (state.currentVideo) {
            state.currentVideo.removeEventListener('play', handlePlay);
            state.currentVideo.removeEventListener('pause', handlePause);
            state.currentVideo.removeEventListener('ended', handleEnded);
        }
        
        state.currentVideo = video;
        
        video.addEventListener('play', handlePlay);
        video.addEventListener('pause', handlePause);
        video.addEventListener('ended', handleEnded);
        
        // Check current state - force send initial state
        const isPlaying = getPlaybackState(video);
        notifyPlaybackChange(isPlaying, true);
        
        log('Video listeners set up');
    }

    function handlePlay() {
        log('Video play event');
        notifyPlaybackChange(true);
    }

    function handlePause() {
        log('Video pause event');
        notifyPlaybackChange(false);
    }

    function handleEnded() {
        log('Video ended event');
        notifyPlaybackChange(false);
    }

    /**
     * Watch for video element changes
     */
    function watchForVideo() {
        const video = findVideoElement();
        if (video) {
            setupVideoListeners(video);
        }
        
        // Use MutationObserver to detect new video elements
        const observer = new MutationObserver(() => {
            const newVideo = findVideoElement();
            if (newVideo && newVideo !== state.currentVideo) {
                setupVideoListeners(newVideo);
            }
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        // Also poll periodically as a fallback
        setInterval(() => {
            const video = findVideoElement();
            if (video && video !== state.currentVideo) {
                setupVideoListeners(video);
            }
        }, 2000);
    }

    /**
     * Handle messages from background
     */
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (!isContextValid()) {
            state.contextValid = false;
            return;
        }
        
        log('Received message:', message.type);
        
        switch (message.type) {
            case 'CONTROL_PLAYBACK':
                controlPlayback(message.action);
                sendResponse({ success: true });
                break;
            
            case 'GET_STATE':
                const video = findVideoElement();
                const isPlaying = getPlaybackState(video);
                sendResponse({
                    success: true,
                    isPlaying: isPlaying,
                    hasVideo: !!video
                });
                break;
            
            case 'PING':
                sendResponse({ success: true, pong: true, source: 'ytmusic' });
                break;
            
            default:
                sendResponse({ success: false, error: 'Unknown message type' });
        }
        
        return true;
    });

    /**
     * Initialize
     */
    async function initialize() {
        log('Initializing YouTube Music content script');
        
        if (!await initializeTabId()) {
            error('Failed to initialize tab ID');
            return;
        }
        
        // Start watching for video
        watchForVideo();
        
        log('YouTube Music content script initialized');
    }

    // Start initialization
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
})();
