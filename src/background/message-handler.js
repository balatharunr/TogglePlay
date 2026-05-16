function registerBackgroundMessageHandler() {
  chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    console.log(
      '[TogglePlay Background] Received message:',
      message.type,
      'from tab:',
      sender.tab && sender.tab.id,
      'source:',
      message.source
    );

    var handleAsync = async function () {
      try {
        var state = togglePlayBackgroundState;

        switch (message.type) {
          case 'GET_TAB_ID':
            return { tabId: sender.tab && sender.tab.id };

          case 'PLAYBACK_STATE_CHANGED':
            console.log(
              '[TogglePlay Background] Handling playback state change:',
              message.isPlaying,
              'from tab:',
              sender.tab && sender.tab.id
            );
            await handlePlaybackStateChange(sender.tab.id, message.isPlaying);
            return { success: true };

          case 'GET_TABS': {
            var tabs = await getAllMediaTabs();
            return {
              success: true,
              tabs: tabs.map(function (tab) {
                return {
                  id: tab.id,
                  title: tab.title,
                  url: tab.url,
                  sourceType: tab.sourceType
                };
              })
            };
          }

          case 'GET_PAIRS': {
            var pairs = Array.from(state.pairs.entries()).map(function (entry) {
              var tabId = entry[0];
              var pairInfo = entry[1];
              return {
                tabId: tabId,
                title: pairInfo.title,
                pairedWith: pairInfo.pairedWith
              };
            });
            return { success: true, pairs: pairs, isEnabled: state.isEnabled };
          }

          case 'ADD_PAIR':
            return await addPair(message.tabId1, message.tabId2);

          case 'REMOVE_PAIR':
            state.pairs.delete(message.tabId1);
            state.pairs.delete(message.tabId2);
            return { success: true };

          case 'CLEAR_ALL_PAIRS':
            state.pairs.clear();
            return { success: true };

          case 'SET_ENABLED':
            state.isEnabled = message.enabled;
            return { success: true };

          case 'PAUSE_BOTH':
            return await handlePauseBoth(sender.tab && sender.tab.id);

          case 'PING':
            return { success: true, pong: true };

          default:
            return { success: false, error: 'Unknown message type' };
        }
      } catch (err) {
        togglePlayError('Error handling message:', err);
        return { success: false, error: err.message };
      }
    };

    handleAsync().then(sendResponse).catch(function (err) {
      togglePlayError('Async handler failed:', err);
      sendResponse({ success: false, error: err.message });
    });

    return true;
  });
}
