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
  if (!pairInfo || !pairInfo.pairedWith || pairInfo.pairedWith.length === 0) {
    togglePlayLog('No pair found for tab', tabId, '(pairs in memory:', state.pairs.size + ')');
    return { success: true, skipped: 'no_pair' };
  }

  var action = TogglePlaySyncModes.resolveAction(state.syncMode, isPlaying);
  if (action === TogglePlaySyncModes.ACTIONS.NONE) {
    togglePlayLog('Exclusive mode: pause on tab ' + tabId + ' — no partner action');
    return { success: true, skipped: 'exclusive_pause' };
  }

  togglePlayLog('Tab ' + tabId + ' is now:', isPlaying ? 'PLAYING' : 'PAUSED', '→', action);

  var pairedTabId = TogglePlayStorageSerializers.normalizeTabId(pairInfo.pairedWith[0].tabId);
  var controlAction = action === TogglePlaySyncModes.ACTIONS.PLAY_PARTNER ? 'PLAY' : 'PAUSE';

  var newCommandId = 'cmd_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
  if (!state.pendingCommands) state.pendingCommands = new Map();
  state.pendingCommands.set(newCommandId, Date.now());
  
  // Cleanup old commands
  for (var [id, time] of state.pendingCommands.entries()) {
    if (Date.now() - time > 5000) state.pendingCommands.delete(id);
  }

  try {
    state.controlledTabs.add(pairedTabId);
    var response = await sendMessageToTab(pairedTabId, {
      type: TogglePlayMessages.CONTROL_PLAYBACK,
      action: controlAction,
      commandId: newCommandId
    });

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
      togglePlayLog('Partner control failed:', response.reason || response.error);
      return {
        success: false,
        error: response.reason || response.error,
        pairedTabId: pairedTabId
      };
    }

    setTimeout(function () {
      state.controlledTabs.delete(pairedTabId);
    }, TogglePlayConfig.CONTROLLED_TAB_TIMEOUT_MS || 1000);

    return {
      success: true,
      partnerAction: controlAction,
      pairedTabId: pairedTabId
    };
  } catch (err) {
    state.controlledTabs.delete(pairedTabId);
    togglePlayError('Failed to control paired tab:', err);
    return { success: false, error: err.message, pairedTabId: pairedTabId };
  }
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
