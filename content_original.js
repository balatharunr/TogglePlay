/**
 * TogglePlay Extension - YouTube Content Script
 * Detects and controls YouTube video playback with robust error handling
 */

(() => {
    'use strict';

    // Configuration
    const CONFIG = {
        DEBOUNCE_DELAY: 500,  // Increased for better stability
        RETRY_DELAY: 1000,
        MAX_RETRIES: 3,
        HEARTBEAT_INTERVAL: 30000,
        VIDEO_SELECTORS: [
            'video',
            'video[src]',
            '.video-stream',
            '.html5-video-player video'
        ]
    };

    // State management
    let state = {
        tabId: null,
        isPlaying: false,
        lastPlayState: null,
        debounceTimer: null,
        heartbeatTimer: null,
        observer: null,
        currentVideo: null,
        connected: false,
        retryCount: 0,
        ignoringOwnCommands: false,  // Flag to ignore events from our own commands
        lastCommandTime: 0
    };

    // Logging utility with tab context
    function log(message, ...args) {
        console.log(`[TogglePlay Content-${state.tabId || 'unknown'}]`, message, ...args);
    }

    function error(message, ...args) {
        console.error(`[TogglePlay Content-${state.tabId || 'unknown'}]`, message, ...args);
    }

    /**
     * Initialize tab ID and establish connection
     */
    async function initializeTabId() {
        try {
            if (chrome?.runtime?.sendMessage) {
                const response = await chrome.runtime.sendMessage({ type: 'GET_TAB_ID' });
                if (response?.tabId) {
                    state.tabId = response.tabId;
                    state.connected = true;
                    log('Tab ID initialized:', state.tabId);
                    return true;
                }
            }
        } catch (err) {
            error('Failed to get tab ID:', err);
        }
        
        state.connected = false;
        return false;
    }

    /**
     * Find the active YouTube video element
     */
    function findVideoElement() {
        // Try different selectors in order of specificity
        for (const selector of CONFIG.VIDEO_SELECTORS) {
            const videos = document.querySelectorAll(selector);
            
            for (const video of videos) {
                // Check if this is a valid, loaded video
                if (video instanceof HTMLVideoElement && 
                    video.readyState >= 1 && 
                    video.duration > 0 && 
                    !video.hidden &&
                    video.offsetParent !== null) {
                    return video;
                }
            }
        }
        
        return null;
    }

    /**
     * Get current playback state
     */
    function getPlaybackState(video) {
        if (!video) return false;
        
        return !video.paused && 
               !video.ended && 
               video.currentTime > 0 && 
               video.readyState > 2;
    }

    /**
     * Send message to background script with retry
     */
    async function sendMessage(message, retries = CONFIG.MAX_RETRIES) {
        if (!state.connected) {
            log('Not connected, attempting to reconnect...');
            const reconnected = await initializeTabId();
            if (!reconnected) {
                throw new Error('Failed to establish connection');
            }
        }

        for (let i = 0; i <= retries; i++) {
            try {
                if (!chrome?.runtime?.sendMessage) {
                    throw new Error('Chrome runtime not available');
                }

                const response = await chrome.runtime.sendMessage({
                    ...message,
                    tabId: state.tabId,
                    timestamp: Date.now()
                });

                if (chrome.runtime.lastError) {
                    throw new Error(chrome.runtime.lastError.message);
                }

                log('Message sent successfully:', message.type);
                state.retryCount = 0;
                return response;

            } catch (err) {
                if (i === retries) {
                    error(`Failed to send message after ${retries + 1} attempts:`, err);
                    state.connected = false;
                    throw err;
                }
                
                log(`Message send attempt ${i + 1} failed, retrying...`, err.message);
                await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY * (i + 1)));
            }
        }
    }

    /**
     * Debounced state change notification
     */
    function notifyStateChange(newState) {
        // Clear existing timer
        if (state.debounceTimer) {
            clearTimeout(state.debounceTimer);
        }

        // Set new debounced timer with longer delay for stability
        state.debounceTimer = setTimeout(async () => {
            // Double-check state hasn't changed during debounce period
            const currentVideo = findVideoElement();
            const currentState = getPlaybackState(currentVideo);
            
            // Only send notification if state is still the same and actually changed
            if (currentState === newState && state.lastPlayState !== newState) {
                state.lastPlayState = newState;
                state.isPlaying = newState;
                
                log('State change confirmed after debounce:', newState ? 'PLAYING' : 'PAUSED');
                
                try {
                    await sendMessage({
                        type: 'PLAYBACK_STATE_CHANGED',
                        isPlaying: newState,
                        url: window.location.href,
                        title: document.title,
                        timestamp: Date.now()
                    });
                } catch (err) {
                    error('Failed to notify state change:', err);
                }
            } else {
                log('State change cancelled during debounce period');
            }
        }, CONFIG.DEBOUNCE_DELAY);
    }

    /**
     * Set up video event listeners
     */
    function setupVideoListeners(video) {
        if (!video || video.hasTogglePlayListeners) {
            return;
        }

        log('Setting up video listeners for:', video);

        const events = ['play', 'pause', 'ended', 'loadstart', 'canplay'];
        
        events.forEach(eventType => {
            video.addEventListener(eventType, () => {
                const isPlaying = getPlaybackState(video);
                
                // Check if this event is from our own command (ignore for 1 second after command)
                const timeSinceCommand = Date.now() - state.lastCommandTime;
                if (state.ignoringOwnCommands && timeSinceCommand < 1000) {
                    log(`Ignoring ${eventType} event (${timeSinceCommand}ms after our command)`);
                    return;
                }
                
                log(`Video event: ${eventType}, isPlaying: ${isPlaying}`);
                notifyStateChange(isPlaying);
            });
        });

        // Mark video as having listeners to avoid duplicates
        video.hasTogglePlayListeners = true;
        state.currentVideo = video;
        
        // Send initial state
        const initialState = getPlaybackState(video);
        notifyStateChange(initialState);
    }

    /**
     * Control video playback
     */
    async function controlPlayback(action) {
        const video = findVideoElement();
        
        if (!video) {
            throw new Error('No video element found');
        }

        const currentState = getPlaybackState(video);
        log(`Control request: ${action}, current state: playing=${currentState}`);

        // Prevent conflicting actions
        if ((action === 'PLAY' && currentState) || (action === 'PAUSE' && !currentState)) {
            log(`No action needed: ${action} requested but video is already in desired state`);
            return;
        }

        // Set flag to ignore events from our own commands
        state.ignoringOwnCommands = true;
        state.lastCommandTime = Date.now();

        try {
            if (action === 'PLAY' && !currentState) {
                log('Executing PLAY command');
                
                // Method 1: Direct video API
                const playPromise = video.play();
                if (playPromise instanceof Promise) {
                    await playPromise;
                }
                
                // Method 2: YouTube play button fallback
                setTimeout(() => {
                    if (!getPlaybackState(video)) {
                        const playButton = document.querySelector('.ytp-play-button[aria-label*="Play"], .ytp-play-button[title*="Play"]');
                        if (playButton) {
                            log('Using play button fallback');
                            playButton.click();
                        }
                    }
                }, 100);
                
            } else if (action === 'PAUSE' && currentState) {
                log('Executing PAUSE command');
                
                // Method 1: Direct video API
                video.pause();
                
                // Method 2: YouTube pause button fallback
                setTimeout(() => {
                    if (getPlaybackState(video)) {
                        const pauseButton = document.querySelector('.ytp-play-button[aria-label*="Pause"], .ytp-play-button[title*="Pause"]');
                        if (pauseButton) {
                            log('Using pause button fallback');
                            pauseButton.click();
                        }
                    }
                }, 100);
            }

            // Verify the action was successful after a short delay
            setTimeout(() => {
                const newState = getPlaybackState(video);
                const expectedState = action === 'PLAY';
                
                if (newState === expectedState) {
                    log(`Playback control successful: ${action} completed`);
                } else {
                    error(`Playback control verification failed: expected ${expectedState}, got ${newState}`);
                }
                
                // Reset ignore flag after verification
                setTimeout(() => {
                    state.ignoringOwnCommands = false;
                }, 500);
                
            }, 200);

        } catch (err) {
            error(`Failed to ${action.toLowerCase()} video:`, err);
            // Reset ignore flag on error
            state.ignoringOwnCommands = false;
            throw err;
        }
    }

    /**
     * Handle messages from background script
     */
    function setupMessageListener() {
        if (!chrome?.runtime?.onMessage) {
            error('Chrome runtime message API not available');
            return;
        }

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
                            return { 
                                success: true, 
                                isPlaying,
                                hasVideo: !!video,
                                url: window.location.href,
                                title: document.title
                            };

                        case 'PING':
                            return { 
                                success: true, 
                                tabId: state.tabId,
                                connected: state.connected 
                            };

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

        log('Message listener registered');
    }

    /**
     * Set up DOM mutation observer for dynamic content
     */
    function setupMutationObserver() {
        if (state.observer) {
            state.observer.disconnect();
        }

        state.observer = new MutationObserver((mutations) => {
            let shouldCheckForVideo = false;

            mutations.forEach((mutation) => {
                // Check if new nodes were added that might contain video
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        if (node.tagName === 'VIDEO' || node.querySelector?.('video')) {
                            shouldCheckForVideo = true;
                        }
                    }
                });
            });

            if (shouldCheckForVideo) {
                log('DOM mutation detected, checking for new video element');
                setTimeout(checkAndSetupVideo, 500); // Slight delay for DOM to stabilize
            }
        });

        state.observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        log('Mutation observer registered');
    }

    /**
     * Check for video and set up listeners
     */
    function checkAndSetupVideo() {
        const video = findVideoElement();
        
        if (video && video !== state.currentVideo) {
            log('New video element found, setting up listeners');
            setupVideoListeners(video);
        } else if (!video && state.currentVideo) {
            log('Video element removed');
            state.currentVideo = null;
        }
    }

    /**
     * Send periodic heartbeat to background
     */
    function startHeartbeat() {
        if (state.heartbeatTimer) {
            clearInterval(state.heartbeatTimer);
        }

        state.heartbeatTimer = setInterval(async () => {
            try {
                await sendMessage({ type: 'HEARTBEAT' });
            } catch (err) {
                error('Heartbeat failed:', err);
                // Try to reconnect
                await initializeTabId();
            }
        }, CONFIG.HEARTBEAT_INTERVAL);

        log('Heartbeat started');
    }

    /**
     * Handle page navigation in YouTube SPA
     */
    function setupNavigationListener() {
        // Listen for YouTube's navigation events
        let lastUrl = window.location.href;
        
        const checkUrlChange = () => {
            const currentUrl = window.location.href;
            if (currentUrl !== lastUrl) {
                log('YouTube navigation detected:', currentUrl);
                lastUrl = currentUrl;
                
                // Reset state for new page
                state.lastPlayState = null;
                state.currentVideo = null;
                
                // Check for video after navigation settles
                setTimeout(checkAndSetupVideo, 1000);
            }
        };

        // Use multiple methods to detect navigation
        setInterval(checkUrlChange, 1000);
        
        // Listen for pushstate/popstate events
        const originalPushState = history.pushState;
        const originalReplaceState = history.replaceState;
        
        history.pushState = function(...args) {
            originalPushState.apply(history, args);
            setTimeout(checkUrlChange, 100);
        };
        
        history.replaceState = function(...args) {
            originalReplaceState.apply(history, args);
            setTimeout(checkUrlChange, 100);
        };
        
        window.addEventListener('popstate', checkUrlChange);
        
        log('Navigation listener registered');
    }

    /**
     * Handle extension context invalidation
     */
    function handleContextInvalidation() {
        const checkContext = () => {
            if (!chrome?.runtime?.id) {
                log('Extension context invalidated, stopping script');
                cleanup();
                return false;
            }
            return true;
        };

        // Check context periodically
        setInterval(() => {
            if (!checkContext()) {
                return;
            }
        }, 5000);
    }

    /**
     * Cleanup function
     */
    function cleanup() {
        log('Cleaning up content script');

        if (state.debounceTimer) {
            clearTimeout(state.debounceTimer);
        }
        
        if (state.heartbeatTimer) {
            clearInterval(state.heartbeatTimer);
        }
        
        if (state.observer) {
            state.observer.disconnect();
        }

        // Reset state
        Object.assign(state, {
            tabId: null,
            isPlaying: false,
            lastPlayState: null,
            debounceTimer: null,
            heartbeatTimer: null,
            observer: null,
            currentVideo: null,
            connected: false,
            retryCount: 0
        });
    }

    /**
     * Initialize the content script
     */
    async function initialize() {
        try {
            log('Initializing YouTube content script on:', window.location.href);

            // Wait for DOM to be ready
            if (document.readyState !== 'complete') {
                await new Promise(resolve => {
                    if (document.readyState === 'loading') {
                        document.addEventListener('DOMContentLoaded', resolve);
                    } else {
                        document.addEventListener('load', resolve);
                    }
                });
            }

            // Initialize connection
            const connected = await initializeTabId();
            if (!connected) {
                error('Failed to initialize connection, retrying...');
                setTimeout(initialize, CONFIG.RETRY_DELAY);
                return;
            }

            // Set up all components
            setupMessageListener();
            setupMutationObserver();
            setupNavigationListener();
            handleContextInvalidation();

            // Initial video check
            setTimeout(checkAndSetupVideo, 500);

            // Start heartbeat
            startHeartbeat();

            log('Content script initialized successfully');

        } catch (err) {
            error('Failed to initialize content script:', err);
            setTimeout(initialize, CONFIG.RETRY_DELAY);
        }
    }

    // Handle page unload
    window.addEventListener('beforeunload', cleanup);

    // Start initialization
    initialize();

})();
