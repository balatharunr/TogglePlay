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

  function createLogger(prefixOrFn, getContextValid) {
    function formatPrefix() {
      var p = typeof prefixOrFn === 'function' ? prefixOrFn() : prefixOrFn;
      return '[' + p + ']';
    }

    return {
      log: function (message) {
        var args = Array.prototype.slice.call(arguments, 1);
        if (!getContextValid()) return;
        var prefix = formatPrefix();
        console.log.apply(console, [prefix].concat([message], args));
        try {
          var str = prefix + ' ' + message + ' ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
          chrome.runtime.sendMessage({ type: 'REMOTE_LOG', level: 'info', message: str }).catch(function(){});
        } catch(e) {}
      },
      error: function (message) {
        var args = Array.prototype.slice.call(arguments, 1);
        if (!getContextValid()) return;
        var prefix = formatPrefix();
        console.error.apply(console, [prefix].concat([message], args));
        try {
          var str = prefix + ' ' + message + ' ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
          chrome.runtime.sendMessage({ type: 'REMOTE_LOG', level: 'error', message: str }).catch(function(){});
        } catch(e) {}
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
