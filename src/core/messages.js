/**
 * Shared runtime message type constants (popup, background, content scripts).
 */
var TogglePlayMessages = (function () {
  'use strict';

  return {
    GET_TAB_ID: 'GET_TAB_ID',
    PLAYBACK_STATE_CHANGED: 'PLAYBACK_STATE_CHANGED',
    CONTROL_PLAYBACK: 'CONTROL_PLAYBACK',
    GET_PLAYBACK_STATE: 'GET_PLAYBACK_STATE',
    PAUSE_BOTH: 'PAUSE_BOTH',
    PING: 'PING',
    GET_TABS: 'GET_TABS',
    GET_PAIRS: 'GET_PAIRS',
    ADD_PAIR: 'ADD_PAIR',
    REMOVE_PAIR: 'REMOVE_PAIR',
    CLEAR_ALL_PAIRS: 'CLEAR_ALL_PAIRS',
    SET_ENABLED: 'SET_ENABLED',
    SET_SYNC_MODE: 'SET_SYNC_MODE'
  };
})();
