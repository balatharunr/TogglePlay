/**
 * Shared runtime messaging for content scripts.
 */
var TogglePlayContentMessaging = (function () {
  'use strict';

  async function initializeTabId(state, logger) {
    if (!TogglePlayContent.isContextValid()) {
      TogglePlayContent.markContextInvalid(state);
      return false;
    }

    try {
      var response = await chrome.runtime.sendMessage({
        type: TogglePlayMessages.GET_TAB_ID
      });
      if (response && response.tabId) {
        state.tabId = response.tabId;
        state.connected = true;
        logger.log('Tab ID initialized:', state.tabId);
        return true;
      }
    } catch (err) {
      if (err.message && err.message.includes('Extension context invalidated')) {
        TogglePlayContent.markContextInvalid(state);
        return false;
      }
      logger.error('Failed to get tab ID:', err);
    }
    return false;
  }

  function createSendMessage(state, logger, options) {
    options = options || {};

    return async function sendMessage(message) {
      if (!TogglePlayContent.isContextValid()) {
        TogglePlayContent.markContextInvalid(state);
        return null;
      }

      try {
        var payload = Object.assign({}, message, { tabId: state.tabId });
        if (options.source) {
          payload.source = options.source;
        }
        return await chrome.runtime.sendMessage(payload);
      } catch (err) {
        if (err.message && (
          err.message.includes('Extension context invalidated') ||
          err.message.includes('disconnected')
        )) {
          TogglePlayContent.markContextInvalid(state);
        } else if (options.logSendErrors) {
          logger.error('Send message failed:', err.message || err);
        }
        return null;
      }
    };
  }

  function createDebouncedNotifier(state, sendMessage, debounceMs) {
    return function notifyStateChange(newState, force) {
      if (!TogglePlayContent.isContextValid()) {
        TogglePlayContent.markContextInvalid(state);
        return;
      }

      if (!force && state.isPlaying === newState) {
        return;
      }

      if (state.debounceTimer) {
        clearTimeout(state.debounceTimer);
      }

      state.debounceTimer = setTimeout(async function () {
        if (!TogglePlayContent.isContextValid()) {
          TogglePlayContent.markContextInvalid(state);
          return;
        }

        state.isPlaying = newState;
        var payload = {
          type: TogglePlayMessages.PLAYBACK_STATE_CHANGED,
          isPlaying: newState
        };
        if (state.lastCommandId) {
          payload.commandId = state.lastCommandId;
          state.lastCommandId = null;
        }
        await sendMessage(payload);
      }, debounceMs);
    };
  }

  return {
    initializeTabId: initializeTabId,
    createSendMessage: createSendMessage,
    createDebouncedNotifier: createDebouncedNotifier
  };
})();
