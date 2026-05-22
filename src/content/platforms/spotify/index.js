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

  function getButtonLabel(button) {
    if (!button) return '';
    return (button.getAttribute('aria-label') || button.getAttribute('title') || '').trim();
  }

  function findPlayPauseButton() {
    var bar = document.querySelector('[data-testid="now-playing-bar"]') ||
      document.querySelector('.Root__now-playing-bar') ||
      document.querySelector('.now-playing-bar');

    var scopes = bar ? [bar, document] : [document];
    var selectors = [
      'button[data-testid="control-button-playpause"]',
      '[data-testid="control-button-playpause"]',
      'button[data-testid="play-button"]',
      'button[aria-label="Pause"]',
      'button[aria-label="Play"]',
      'button[title="Pause"]',
      'button[title="Play"]'
    ];

    for (var s = 0; s < scopes.length; s++) {
      for (var i = 0; i < selectors.length; i++) {
        var button = scopes[s].querySelector(selectors[i]);
        if (button && button.tagName === 'BUTTON') {
          return button;
        }
      }
    }
    return null;
  }

  /**
   * True only when Spotify is playing on another device (phone, speaker, etc.).
   * The "Connect to a device" button is always visible on web — not a signal.
   */
  function isPlaybackOnRemoteDevice(button) {
    button = button || findPlayPauseButton();
    if (!button) {
      return false;
    }

    var label = getButtonLabel(button).toLowerCase();
    if (label.indexOf('play on ') === 0 || label.indexOf('listen on ') === 0) {
      return true;
    }

    var devicePicker = document.querySelector('[data-testid="device-picker-button"]');
    if (devicePicker) {
      var pickerLabel = (devicePicker.getAttribute('aria-label') || '').toLowerCase();
      if (pickerLabel.indexOf('listening on') === 0) {
        var onWeb = pickerLabel.indexOf('web player') !== -1 ||
          pickerLabel.indexOf('this computer') !== -1 ||
          pickerLabel.indexOf('this browser') !== -1 ||
          pickerLabel.indexOf('chrome') !== -1 ||
          pickerLabel.indexOf('safari') !== -1 ||
          pickerLabel.indexOf('firefox') !== -1 ||
          pickerLabel.indexOf('edge') !== -1;
        if (!onWeb) {
          return true;
        }
      }
    }

    return false;
  }

  function isWebPlayerActive() {
    var button = findPlayPauseButton();
    if (!button) {
      return false;
    }
    return !isPlaybackOnRemoteDevice(button);
  }

  function isPlayingFromButton(button) {
    if (!button) return false;

    var label = getButtonLabel(button).toLowerCase();
    if (label === 'pause' || label.indexOf('pause') === 0) {
      return true;
    }
    if (label === 'play' || label.indexOf('play') === 0) {
      return false;
    }

    var svg = button.querySelector('svg');
    if (svg) {
      if (svg.querySelectorAll('rect').length >= 2) return true;
      if (svg.querySelectorAll('polygon, path[d*="M8"]').length > 0) return false;
    }

    return false;
  }

  function getPlaybackState() {
    var button = findPlayPauseButton();
    if (!button || isPlaybackOnRemoteDevice(button)) {
      return false;
    }
    return isPlayingFromButton(button);
  }

  function controlPlayback(action) {
    logger.log('Control request:', action);

    var button = findPlayPauseButton();
    if (!button) {
      logger.log('No play/pause button found — is the Spotify player loaded?');
      return { success: false, reason: 'NO_PLAYER' };
    }

    if (isPlaybackOnRemoteDevice(button)) {
      logger.log('Spotify is playing on another device, not this browser tab');
      return { success: false, reason: 'DEVICE_NOT_WEB' };
    }

    var isCurrentlyPlaying = isPlayingFromButton(button);

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
