function prunePendingCommands(state) {
  if (!state.pendingCommands) {
    state.pendingCommands = new Map();
    return;
  }
  for (var entry of state.pendingCommands.entries()) {
    if (Date.now() - entry[1] > 5000) {
      state.pendingCommands.delete(entry[0]);
    }
  }
}

function registerPendingCommand(state) {
  prunePendingCommands(state);
  var commandId = 'cmd_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
  state.pendingCommands.set(commandId, Date.now());
  return commandId;
}

async function controlTabPlayback(tabId, action, commandId) {
  var state = togglePlayBackgroundState;
  tabId = TogglePlayStorageSerializers.normalizeTabId(tabId);
  var cmdId = commandId || registerPendingCommand(state);

  state.controlledTabs.add(tabId);
  try {
    var response = await sendMessageToTab(tabId, {
      type: TogglePlayMessages.CONTROL_PLAYBACK,
      action: action,
      commandId: cmdId
    });

    setTimeout(function () {
      state.controlledTabs.delete(tabId);
    }, TogglePlayConfig.CONTROLLED_TAB_TIMEOUT_MS || 1000);

    return response;
  } catch (err) {
    state.controlledTabs.delete(tabId);
    throw err;
  }
}

/** Pause every other media tab so only one plays in the browser. */
async function pauseOtherMediaTabs(playingTabId) {
  var state = togglePlayBackgroundState;
  playingTabId = TogglePlayStorageSerializers.normalizeTabId(playingTabId);
  var mediaTabs = await getAllMediaTabs();
  var paused = 0;

  for (var i = 0; i < mediaTabs.length; i++) {
    var otherId = TogglePlayStorageSerializers.normalizeTabId(mediaTabs[i].id);
    if (otherId === playingTabId) {
      continue;
    }

    try {
      var response = await controlTabPlayback(otherId, 'PAUSE');
      if (response && response.success !== false) {
        paused++;
      }
    } catch (err) {
      togglePlayLog('Could not pause tab ' + otherId + ' for exclusive audio:', err.message);
    }
  }

  if (paused > 0) {
    togglePlayLog('Exclusive audio: paused', paused, 'other tab(s)');
  }

  return paused;
}

async function handlePlaybackStateChange(tabId, isPlaying, commandId) {
  var state = togglePlayBackgroundState;
  tabId = TogglePlayStorageSerializers.normalizeTabId(tabId);

  if (!state.isEnabled) {
    togglePlayLog('Extension disabled');
    return { success: true, skipped: 'disabled' };
  }

  if (commandId && state.pendingCommands && state.pendingCommands.has(commandId)) {
    togglePlayLog('Ignoring state change from controlled tab ' + tabId + ' (command ' + commandId + ')');
    state.pendingCommands.delete(commandId);
    return { success: true, skipped: 'echo' };
  }

  // Fallback for older content scripts
  if (state.controlledTabs.has(tabId)) {
    togglePlayLog('Ignoring state change from controlled tab ' + tabId + ' (legacy timeout)');
    state.controlledTabs.delete(tabId);
    return { success: true, skipped: 'echo' };
  }

  var pairInfo = getPairForTab(tabId);
  var hasPair = pairInfo && pairInfo.pairedWith && pairInfo.pairedWith.length > 0;
  var result = { success: true };

  if (hasPair) {
    var action = TogglePlaySyncModes.resolveMirrorAction(isPlaying);
    var pairedTabId = TogglePlayStorageSerializers.normalizeTabId(pairInfo.pairedWith[0].tabId);
    var controlAction = action === TogglePlaySyncModes.ACTIONS.PLAY_PARTNER ? 'PLAY' : 'PAUSE';

    togglePlayLog('Tab ' + tabId + ' is now:', isPlaying ? 'PLAYING' : 'PAUSED', '→', action);

    try {
      var response = await controlTabPlayback(pairedTabId, controlAction);

      if (!response) {
        togglePlayLog(
          'Partner tab ' + pairedTabId + ' did not respond — refresh that tab after installing/reloading the extension'
        );
        return {
          success: false,
          error: 'partner_unreachable',
          pairedTabId: pairedTabId
        };
      }

      if (response.success === false) {
        var reason = response.reason || response.error;
        if (reason === 'DEVICE_NOT_WEB') {
          togglePlayLog(
            'Spotify partner tab is not the active device — open Spotify here and choose This computer'
          );
          return { success: true, skipped: 'device_not_web', pairedTabId: pairedTabId };
        }
        togglePlayLog('Partner control failed:', reason);
        return {
          success: false,
          error: reason,
          pairedTabId: pairedTabId
        };
      }

      result = {
        success: true,
        partnerAction: controlAction,
        pairedTabId: pairedTabId
      };
    } catch (err) {
      togglePlayError('Failed to control paired tab:', err);
      return { success: false, error: err.message, pairedTabId: pairedTabId };
    }
  } else if (!state.exclusiveModeEnabled) {
    togglePlayLog('No pair found for tab', tabId, '(pairs in memory:', state.pairs.size + ')');
    return { success: true, skipped: 'no_pair' };
  }

  if (state.exclusiveModeEnabled && isPlaying) {
    result.exclusivePaused = await pauseOtherMediaTabs(tabId);
  }

  return result;
}

async function handlePauseBoth(senderTabId) {
  var state = togglePlayBackgroundState;
  senderTabId = TogglePlayStorageSerializers.normalizeTabId(senderTabId);
  var senderPairInfo = getPairForTab(senderTabId);

  if (!senderPairInfo || !senderPairInfo.pairedWith || senderPairInfo.pairedWith.length === 0) {
    return { success: false, error: 'No paired tabs found' };
  }

  var pairedTabId = TogglePlayStorageSerializers.normalizeTabId(senderPairInfo.pairedWith[0].tabId);
  var wasEnabled = state.isEnabled;
  state.isEnabled = false;

  state.controlledTabs.add(senderTabId);
  state.controlledTabs.add(pairedTabId);

  await sendMessageToTab(pairedTabId, {
    type: TogglePlayMessages.CONTROL_PLAYBACK,
    action: 'PAUSE'
  });

  setTimeout(function () {
    state.isEnabled = wasEnabled;
    state.controlledTabs.delete(senderTabId);
    state.controlledTabs.delete(pairedTabId);
    togglePlayLog('Re-enabled toggle after PAUSE_BOTH');
  }, TogglePlayConfig.PAUSE_BOTH_SETTLE_MS);

  togglePlayLog('Paused both tabs:', senderTabId, 'and', pairedTabId);
  return { success: true, pausedTabs: [senderTabId, pairedTabId] };
}
