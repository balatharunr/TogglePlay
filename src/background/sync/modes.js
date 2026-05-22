/**
 * Paired tabs always mirror: play → pause partner, pause → play partner.
 */
var TogglePlaySyncModes = (function () {
  'use strict';

  var ACTIONS = {
    PAUSE_PARTNER: 'PAUSE_PARTNER',
    PLAY_PARTNER: 'PLAY_PARTNER'
  };

  function resolveMirrorAction(isPlaying) {
    return isPlaying ? ACTIONS.PAUSE_PARTNER : ACTIONS.PLAY_PARTNER;
  }

  return {
    ACTIONS: ACTIONS,
    resolveMirrorAction: resolveMirrorAction
  };
})();
