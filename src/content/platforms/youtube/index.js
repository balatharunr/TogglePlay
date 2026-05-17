/**
 * YouTube watch-page content script.
 */
(function () {
  'use strict';

  var SESSION_ID = Date.now().toString(36) + Math.random().toString(36).substr(2, 9);

  var state = {
    tabId: null,
    isPlaying: false,
    debounceTimer: null,
    currentVideo: null,
    connected: false,
    contextValid: true
  };

  function isActive() {
    return state.contextValid && TogglePlayContent.isContextValid();
  }

  function logPrefix() {
    return 'TogglePlay Content-' + (state.tabId || 'pending');
  }

  var logger = TogglePlayContent.createLogger(logPrefix, isActive);

  var sendMessage = TogglePlayContentMessaging.createSendMessage(state, logger, {
    source: 'youtube',
    logSendErrors: true
  });

  function findVideoElement() {
    var video = document.querySelector('video');
    return video && video.readyState >= 1 && video.duration > 0 ? video : null;
  }

  function getPlaybackState(video) {
    if (!video) return false;
    return !video.paused && !video.ended && video.currentTime > 0;
  }

  function notifyStateChange(newState, force) {
    if (!isActive()) {
      TogglePlayContent.markContextInvalid(state);
      return;
    }

    if (state.debounceTimer) {
      clearTimeout(state.debounceTimer);
    }

    state.debounceTimer = setTimeout(async function () {
      if (!isActive()) {
        TogglePlayContent.markContextInvalid(state);
        return;
      }

      if (!force && state.isPlaying === newState) {
        return;
      }

      state.isPlaying = newState;
      logger.log('Notifying state change:', newState ? 'PLAYING' : 'PAUSED');
      var response = await sendMessage({
        type: TogglePlayMessages.PLAYBACK_STATE_CHANGED,
        isPlaying: newState
      });
      if (!response) {
        logger.error('Background did not respond (reload extension or re-pair tabs)');
        return;
      }
      if (response.skipped) {
        logger.log('Sync skipped:', response.skipped);
      } else if (response.partnerAction) {
        logger.log('Sync applied:', response.partnerAction, 'on partner tab', response.pairedTabId);
      }
    }, TogglePlayConfig.DEBOUNCE_MS.YOUTUBE);
  }

  function setupVideoListeners(video) {
    if (!video) return;

    var listenerKey = 'togglePlayListenersSet_' + SESSION_ID;
    if (video[listenerKey]) return;

    logger.log('Setting up video listeners');

    ['play', 'pause', 'ended'].forEach(function (eventType) {
      video.addEventListener(eventType, function () {
        if (!isActive()) {
          TogglePlayContent.markContextInvalid(state);
          return;
        }
        notifyStateChange(getPlaybackState(video));
      });
    });

    video[listenerKey] = true;
    state.currentVideo = video;
    // Only report initial state when already playing (avoid mirror mode starting partner on load).
    var initialPlaying = getPlaybackState(video);
    state.isPlaying = initialPlaying;
    if (initialPlaying) {
      notifyStateChange(true, true);
    }
  }

  async function controlPlayback(action) {
    var video = findVideoElement();
    if (!video) {
      throw new Error('No video element found');
    }

    logger.log('Control request:', action);

    if (action === 'PLAY') {
      await video.play();
    } else if (action === 'PAUSE') {
      video.pause();
    }
  }

  chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    var handleAsync = async function () {
      try {
        switch (message.type) {
          case TogglePlayMessages.CONTROL_PLAYBACK:
            await controlPlayback(message.action);
            return { success: true };
          case TogglePlayMessages.GET_PLAYBACK_STATE: {
            var video = findVideoElement();
            return {
              success: true,
              isPlaying: getPlaybackState(video),
              hasVideo: !!video
            };
          }
          case TogglePlayMessages.PING:
            return { success: true };
          default:
            return { success: false, error: 'Unknown message type' };
        }
      } catch (err) {
        logger.error('Error handling message:', err);
        return { success: false, error: err.message };
      }
    };

    handleAsync().then(sendResponse).catch(function (err) {
      logger.error('Async handler failed:', err);
      sendResponse({ success: false, error: err.message });
    });

    return true;
  });

  function checkForVideo() {
    if (!isActive()) {
      TogglePlayContent.markContextInvalid(state);
      return;
    }
    var video = findVideoElement();
    if (video && video !== state.currentVideo) {
      logger.log('New video found, setting up listeners');
      setupVideoListeners(video);
    }
  }

  async function initialize() {
    try {
      logger.log('Initializing content script');
      await TogglePlayContentMessaging.initializeTabId(state, logger);

      setupPauseBothShortcut(state, sendMessage, logger, {
        onLocalPause: function () {
          var video = findVideoElement();
          if (video && !video.paused) {
            video.pause();
          }
        }
      });

      var intervalId = setInterval(function () {
        if (!isActive()) {
          TogglePlayContent.markContextInvalid(state);
          clearInterval(intervalId);
          return;
        }
        checkForVideo();
      }, 2000);

      setTimeout(checkForVideo, 1000);
      logger.log('Content script initialized');
    } catch (err) {
      logger.error('Failed to initialize:', err);
    }
  }

  initialize();
})();
