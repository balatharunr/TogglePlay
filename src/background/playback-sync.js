async function handlePlaybackStateChange(tabId, isPlaying) {
  var state = togglePlayBackgroundState;

  if (!state.isEnabled) {
    togglePlayLog('Extension disabled');
    return;
  }

  if (state.controlledTabs.has(tabId)) {
    togglePlayLog('Ignoring state change from controlled tab ' + tabId);
    state.controlledTabs.delete(tabId);
    return;
  }

  var pairInfo = state.pairs.get(tabId);
  if (!pairInfo || !pairInfo.pairedWith || pairInfo.pairedWith.length === 0) {
    togglePlayLog('No pair found for tab', tabId);
    return;
  }

  togglePlayLog('Tab ' + tabId + ' is now:', isPlaying ? 'PLAYING' : 'PAUSED');

  var pairedTabId = pairInfo.pairedWith[0].tabId;

  try {
    if (isPlaying) {
      togglePlayLog('Pausing paired tab ' + pairedTabId);
      state.controlledTabs.add(pairedTabId);
      await sendMessageToTab(pairedTabId, {
        type: 'CONTROL_PLAYBACK',
        action: 'PAUSE'
      });
    } else {
      togglePlayLog('Playing paired tab ' + pairedTabId);
      state.controlledTabs.add(pairedTabId);
      await sendMessageToTab(pairedTabId, {
        type: 'CONTROL_PLAYBACK',
        action: 'PLAY'
      });
    }

    setTimeout(function () {
      state.controlledTabs.delete(pairedTabId);
    }, TogglePlayConfig.CONTROLLED_TAB_TIMEOUT_MS);
  } catch (err) {
    state.controlledTabs.delete(pairedTabId);
    togglePlayError('Failed to control paired tab:', err);
  }
}

async function handlePauseBoth(senderTabId) {
  var state = togglePlayBackgroundState;
  var senderPairInfo = state.pairs.get(senderTabId);

  if (!senderPairInfo || !senderPairInfo.pairedWith || senderPairInfo.pairedWith.length === 0) {
    return { success: false, error: 'No paired tabs found' };
  }

  var pairedTabId = senderPairInfo.pairedWith[0].tabId;
  var wasEnabled = state.isEnabled;
  state.isEnabled = false;

  state.controlledTabs.add(senderTabId);
  state.controlledTabs.add(pairedTabId);

  await sendMessageToTab(pairedTabId, { type: 'CONTROL_PLAYBACK', action: 'PAUSE' });

  setTimeout(function () {
    state.isEnabled = wasEnabled;
    state.controlledTabs.delete(senderTabId);
    state.controlledTabs.delete(pairedTabId);
    togglePlayLog('Re-enabled toggle after PAUSE_BOTH');
  }, TogglePlayConfig.PAUSE_BOTH_SETTLE_MS);

  togglePlayLog('Paused both tabs:', senderTabId, 'and', pairedTabId);
  return { success: true, pausedTabs: [senderTabId, pairedTabId] };
}
