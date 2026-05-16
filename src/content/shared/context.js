/**
 * Shared content-script utilities (extension context, logging).
 */
var TogglePlayContent = (function () {
  'use strict';

  function isContextValid() {
    try {
      return !!(chrome.runtime && chrome.runtime.id);
    } catch (e) {
      return false;
    }
  }

  function createLogger(prefix, getContextValid) {
    return {
      log: function (message) {
        var args = Array.prototype.slice.call(arguments, 1);
        if (!getContextValid()) return;
        console.log.apply(console, ['[' + prefix + ']'].concat([message], args));
      },
      error: function (message) {
        var args = Array.prototype.slice.call(arguments, 1);
        if (!getContextValid()) return;
        console.error.apply(console, ['[' + prefix + ']'].concat([message], args));
      }
    };
  }

  function markContextInvalid(state) {
    state.contextValid = false;
  }

  function whenContextValid(state, callback) {
    if (!state.contextValid || !isContextValid()) {
      markContextInvalid(state);
      return false;
    }
    return callback();
  }

  return {
    isContextValid: isContextValid,
    createLogger: createLogger,
    markContextInvalid: markContextInvalid,
    whenContextValid: whenContextValid
  };
})();
