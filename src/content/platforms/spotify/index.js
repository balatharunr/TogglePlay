/**
 * Spotify web player content script (DOM button control; web player must be active device).
 */
(function () {
  'use strict';

  var state = {
    tabId: null,
    isPlaying: false,
    debounceTimer: null,
    observer: null,
    connected: false,
    contextValid: true,
    lastKnownState: null,
    playerReady: false
  };

  function isActive() {
    return state.contextValid && TogglePlayContent.isContextValid();
  }

  var logger = TogglePlayContent.createLogger(
    'TogglePlay Spotify-' + (state.tabId || 'unknown'),
    isActive
  );

  var sendMessage = TogglePlayContentMessaging.createSendMessage(state, logger, {
    source: 'spotify'
  });

  var notifyStateChange = TogglePlayContentMessaging.createDebouncedNotifier(
    state,
    sendMessage,
    TogglePlayConfig.DEBOUNCE_MS.SPOTIFY
  );

  function findPlayPauseButton() {
    var selectors = [
      'button[data-testid="control-button-playpause"]',
      '[data-testid="control-button-playpause"]',
      'button[aria-label="Pause"]',
      'button[aria-label="Play"]',
      '.player-controls button[aria-label="Pause"]',
      '.player-controls button[aria-label="Play"]'
    ];

    for (var i = 0; i < selectors.length; i++) {
      var button = document.querySelector(selectors[i]);
      if (button) return button;
    }
    return null;
  }

  function isWebPlayerActive() {
    var connectSelectors = [
      '[data-testid="connect-device"]',
      '[data-testid="web-player-connect-device"]',
      'button[aria-label*="Connect to a device"]',
      'button[aria-label*="Listen on another device"]'
    ];

    for (var i = 0; i < connectSelectors.length; i++) {
      if (document.querySelector(connectSelectors[i])) {
        return false;
      }
    }

    var button = findPlayPauseButton();
    if (!button) {
      return true;
    }

    var label = (button.getAttribute('aria-label') || '').toLowerCase();
    if (label.indexOf('play on ') === 0) {
      return false;
    }

    var devicePicker = document.querySelector('[data-testid="device-picker-button"]');
    if (devicePicker) {
      var pickerLabel = (devicePicker.getAttribute('aria-label') || '').toLowerCase();
      if (pickerLabel.indexOf('listening on') !== -1 &&
          pickerLabel.indexOf('web') === -1 &&
          pickerLabel.indexOf('browser') === -1 &&
          pickerLabel.indexOf('this computer') === -1) {
        return false;
      }
    }

    if (button.disabled || button.getAttribute('aria-disabled') === 'true') {
      return false;
    }

    return true;
  }

  function getPlaybackState() {
    if (!isWebPlayerActive()) {
      return false;
    }

    var button = findPlayPauseButton();
    if (!button) return false;

    var ariaLabel = (button.getAttribute('aria-label') || '').toLowerCase();
    if (ariaLabel.includes('pause')) return true;
    if (ariaLabel.includes('play')) return false;

    var svg = button.querySelector('svg');
    if (svg) {
      if (svg.querySelectorAll('rect').length >= 2) return true;
      if (svg.querySelectorAll('polygon').length > 0) return false;
    }

    return false;
  }

  function controlPlayback(action) {
    logger.log('Control request:', action);

    if (!isWebPlayerActive()) {
      logger.log('Spotify web player is not the active device');
      return { success: false, reason: 'DEVICE_NOT_WEB' };
    }

    var button = findPlayPauseButton();
    if (!button) {
      logger.log('ERROR: No play/pause button found - is Spotify player loaded?');
      return { success: false, reason: 'NO_PLAYER' };
    }

    var isCurrentlyPlaying = getPlaybackState();

    if (action === 'PLAY' && !isCurrentlyPlaying) {
      button.click();
    } else if (action === 'PAUSE' && isCurrentlyPlaying) {
      button.click();
    }

    return { success: true };
  }

  function setupPlayStateObserver() {
    if (state.observer) {
      state.observer.disconnect();
    }

    var observeTarget = document.querySelector('[data-testid="now-playing-bar"]') ||
      document.querySelector('.now-playing-bar') ||
      document.body;

    state.observer = new MutationObserver(function () {
      if (!isActive()) {
        TogglePlayContent.markContextInvalid(state);
        state.observer && state.observer.disconnect();
        return;
      }

      var isPlaying = getPlaybackState();
      if (isPlaying !== state.lastKnownState) {
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

    var pollInterval = setInterval(function () {
      if (!isActive()) {
        clearInterval(pollInterval);
        return;
      }
      var isPlaying = getPlaybackState();
      if (isPlaying !== state.lastKnownState) {
        state.lastKnownState = isPlaying;
        notifyStateChange(isPlaying);
      }
    }, 500);

    var initialState = getPlaybackState();
    state.lastKnownState = initialState;
    state.isPlaying = initialState;
    notifyStateChange(initialState, true);
  }

  chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    try {
      switch (message.type) {
        case TogglePlayMessages.CONTROL_PLAYBACK: {
          if (message.commandId) state.lastCommandId = message.commandId;
          var result = controlPlayback(message.action);
          sendResponse(result || { success: true });
          break;
        }
        case TogglePlayMessages.GET_PLAYBACK_STATE:
          sendResponse({
            success: true,
            isPlaying: getPlaybackState(),
            hasPlayer: !!findPlayPauseButton(),
            webPlayerActive: isWebPlayerActive()
          });
          break;
        case TogglePlayMessages.PING:
          sendResponse({ success: true });
          break;
        default:
          sendResponse({ success: false, error: 'Unknown message type' });
      }
    } catch (err) {
      logger.error('Error handling message:', err);
      sendResponse({ success: false, error: err.message });
    }
    return true;
  });

  function waitForPlayer() {
    var attempts = 0;
    var maxAttempts = 60;

    var checkInterval = setInterval(function () {
      if (!isActive()) {
        clearInterval(checkInterval);
        return;
      }

      attempts++;
      if (findPlayPauseButton()) {
        state.playerReady = true;
        clearInterval(checkInterval);
        setupPlayStateObserver();
      } else if (attempts >= maxAttempts) {
        clearInterval(checkInterval);
      }
    }, 1000);
  }

  async function initialize() {
    try {
      logger.log('=== TogglePlay Spotify Extension ===');
      await TogglePlayContentMessaging.initializeTabId(state, logger);

      setupPauseBothShortcut(state, sendMessage, logger, {
        blockedTags: ['INPUT', 'TEXTAREA', 'SEARCH'],
        onLocalPause: function () {
          controlPlayback('PAUSE');
        }
      });

      setTimeout(waitForPlayer, 1500);
      logger.log('Initialization complete');
    } catch (err) {
      logger.error('Failed to initialize:', err);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
})();
