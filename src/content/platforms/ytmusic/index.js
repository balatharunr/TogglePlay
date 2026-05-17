/**
 * YouTube Music content script.
 */
(function () {
  'use strict';

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

  var logger = TogglePlayContent.createLogger(
    'TogglePlay YTMusic-' + (state.tabId || 'unknown'),
    isActive
  );

  var sendMessage = TogglePlayContentMessaging.createSendMessage(state, logger, {
    source: 'ytmusic',
    logSendErrors: true
  });

  var notifyPlaybackChange = TogglePlayContentMessaging.createDebouncedNotifier(
    state,
    sendMessage,
    TogglePlayConfig.DEBOUNCE_MS.YTMUSIC
  );

  function findVideoElement() {
    var video = document.querySelector('video.html5-main-video') || document.querySelector('video');
    return video && video.readyState >= 1 && video.duration > 0 ? video : null;
  }

  function getPlaybackState(video) {
    if (!video) return false;
    return !video.paused && !video.ended && video.currentTime > 0;
  }

  function findPlayPauseButton() {
    var selectors = [
      '#play-pause-button',
      'tp-yt-paper-icon-button#play-pause-button',
      '.ytmusic-player-bar #play-pause-button',
      '[aria-label="Play"]',
      '[aria-label="Pause"]'
    ];

    for (var i = 0; i < selectors.length; i++) {
      var button = document.querySelector(selectors[i]);
      if (button) return button;
    }
    return null;
  }

  function clickPlayPauseButton() {
    var button = findPlayPauseButton();
    if (button) {
      logger.log('Clicking play/pause button');
      button.click();
    } else {
      logger.log('Play/pause button not found');
    }
  }

  function controlPlayback(action) {
    logger.log('Controlling playback:', action);
    var video = findVideoElement();

    if (video) {
      if (action === 'PLAY') {
        video.play().catch(function () {
          clickPlayPauseButton();
        });
      } else if (action === 'PAUSE') {
        video.pause();
      } else if (action === 'TOGGLE') {
        if (video.paused) {
          video.play().catch(function () {
            clickPlayPauseButton();
          });
        } else {
          video.pause();
        }
      }
      return;
    }

    clickPlayPauseButton();
  }

  function handlePlay() {
    notifyPlaybackChange(true);
  }

  function handlePause() {
    notifyPlaybackChange(false);
  }

  function handleEnded() {
    notifyPlaybackChange(false);
  }

  function setupVideoListeners(video) {
    if (state.currentVideo === video) return;

    if (state.currentVideo) {
      state.currentVideo.removeEventListener('play', handlePlay);
      state.currentVideo.removeEventListener('pause', handlePause);
      state.currentVideo.removeEventListener('ended', handleEnded);
    }

    state.currentVideo = video;
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handleEnded);

    notifyPlaybackChange(getPlaybackState(video), true);
    logger.log('Video listeners set up');
  }

  function watchForVideo() {
    var video = findVideoElement();
    if (video) setupVideoListeners(video);

    var observer = new MutationObserver(function () {
      var newVideo = findVideoElement();
      if (newVideo && newVideo !== state.currentVideo) {
        setupVideoListeners(newVideo);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    setInterval(function () {
      var found = findVideoElement();
      if (found && found !== state.currentVideo) {
        setupVideoListeners(found);
      }
    }, 2000);
  }

  chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    if (!isActive()) {
      TogglePlayContent.markContextInvalid(state);
      return;
    }

    switch (message.type) {
      case TogglePlayMessages.CONTROL_PLAYBACK:
        if (message.commandId) state.lastCommandId = message.commandId;
        controlPlayback(message.action);
        sendResponse({ success: true });
        break;
      case TogglePlayMessages.GET_PLAYBACK_STATE: {
        var v = findVideoElement();
        sendResponse({
          success: true,
          isPlaying: getPlaybackState(v),
          hasVideo: !!v
        });
        break;
      }
      case TogglePlayMessages.PING:
        sendResponse({ success: true, pong: true, source: 'ytmusic' });
        break;
      default:
        sendResponse({ success: false, error: 'Unknown message type' });
    }

    return true;
  });

  async function initialize() {
    logger.log('Initializing YouTube Music content script');

    if (!await TogglePlayContentMessaging.initializeTabId(state, logger)) {
      logger.error('Failed to initialize tab ID');
      return;
    }

    setupPauseBothShortcut(state, sendMessage, logger, {
      blockedTags: ['INPUT', 'TEXTAREA', 'SEARCH'],
      onLocalPause: function () {
        var video = findVideoElement();
        if (video && !video.paused) {
          video.pause();
        } else {
          clickPlayPauseButton();
        }
      }
    });

    watchForVideo();
    logger.log('YouTube Music content script initialized');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
})();
