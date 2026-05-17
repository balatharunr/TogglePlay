/**
 * Sync mode state machine: Exclusive (default) vs Mirror.
 */
var TogglePlaySyncModes = (function () {
  'use strict';

  var ACTIONS = {
    PAUSE_PARTNER: 'PAUSE_PARTNER',
    PLAY_PARTNER: 'PLAY_PARTNER',
    NONE: 'NONE'
  };

  function resolveAction(syncMode, isPlaying) {
    var mode = syncMode || TogglePlayConfig.DEFAULT_SYNC_MODE;

    if (mode === TogglePlayConfig.SYNC_MODES.MIRROR) {
      return isPlaying ? ACTIONS.PAUSE_PARTNER : ACTIONS.PLAY_PARTNER;
    }

    // Exclusive: only pause the partner when this tab starts playing.
    if (isPlaying) {
      return ACTIONS.PAUSE_PARTNER;
    }
    return ACTIONS.NONE;
  }

  return {
    ACTIONS: ACTIONS,
    resolveAction: resolveAction
  };
})();
