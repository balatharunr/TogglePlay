async function enrichSpotifyTabStatus(tabs) {
  var enriched = [];

  for (var i = 0; i < tabs.length; i++) {
    var tab = tabs[i];
    if (tab.sourceType !== 'spotify') {
      enriched.push(tab);
      continue;
    }

    var webPlayerActive = true;
    try {
      var response = await sendMessageToTab(tab.id, {
        type: TogglePlayMessages.GET_PLAYBACK_STATE
      });
      if (response && response.webPlayerActive === false) {
        webPlayerActive = false;
      }
    } catch (err) {
      webPlayerActive = true;
    }

    enriched.push(Object.assign({}, tab, { webPlayerActive: webPlayerActive }));
  }

  return enriched;
}

function registerBackgroundMessageHandler() {
  chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    var handleAsync = async function () {
      await ensureHydrated();

      try {
        var state = togglePlayBackgroundState;
        var type = message.type;

        switch (type) {
          case TogglePlayMessages.GET_TAB_ID:
            return { tabId: sender.tab && sender.tab.id };

          case TogglePlayMessages.PLAYBACK_STATE_CHANGED: {
            if (!sender.tab || sender.tab.id === undefined) {
              togglePlayError('PLAYBACK_STATE_CHANGED missing sender.tab');
              return { success: false, error: 'no_sender_tab' };
            }
            togglePlayLog(
              'Playback state change:',
              message.isPlaying,
              'from tab:',
              sender.tab.id,
              'source:',
              message.source
            );
            return await handlePlaybackStateChange(sender.tab.id, message.isPlaying);
          }

          case TogglePlayMessages.GET_TABS: {
            var mediaTabs = await getAllMediaTabs();
            var tabList = mediaTabs.map(function (tab) {
              return {
                id: tab.id,
                title: tab.title,
                url: tab.url,
                sourceType: tab.sourceType
              };
            });
            tabList = await enrichSpotifyTabStatus(tabList);
            return { success: true, tabs: tabList };
          }

          case TogglePlayMessages.GET_PAIRS: {
            var pairs = Array.from(state.pairs.entries()).map(function (entry) {
              var tabId = entry[0];
              var pairInfo = entry[1];
              return {
                tabId: tabId,
                title: pairInfo.title,
                url: pairInfo.url,
                sourceType: pairInfo.sourceType,
                pairedWith: pairInfo.pairedWith
              };
            });
            return {
              success: true,
              pairs: pairs,
              isEnabled: state.isEnabled,
              syncMode: state.syncMode
            };
          }

          case TogglePlayMessages.ADD_PAIR:
            return await addPair(message.tabId1, message.tabId2);

          case TogglePlayMessages.REMOVE_PAIR: {
            var id1 = TogglePlayStorageSerializers.normalizeTabId(message.tabId1);
            var id2 = TogglePlayStorageSerializers.normalizeTabId(message.tabId2);
            state.pairs.delete(id1);
            state.pairs.delete(id2);
            await persistBackgroundState({ pairs: true });
            return { success: true };
          }

          case TogglePlayMessages.CLEAR_ALL_PAIRS:
            state.pairs.clear();
            await persistBackgroundState({ pairs: true });
            return { success: true };

          case TogglePlayMessages.SET_ENABLED:
            await persistBackgroundState({ isEnabled: message.enabled });
            return { success: true };

          case TogglePlayMessages.SET_SYNC_MODE: {
            var mode = message.mode;
            if (mode !== TogglePlayConfig.SYNC_MODES.EXCLUSIVE &&
                mode !== TogglePlayConfig.SYNC_MODES.MIRROR) {
              return { success: false, error: 'Invalid sync mode' };
            }
            await persistBackgroundState({ syncMode: mode });
            return { success: true, syncMode: mode };
          }

          case TogglePlayMessages.PAUSE_BOTH:
            return await handlePauseBoth(sender.tab && sender.tab.id);

          case TogglePlayMessages.PING:
            return { success: true, pong: true };

          case TogglePlayMessages.REMOTE_LOG:
            handleRemoteLog(message.level || 'info', message.message);
            return { success: true };

          case TogglePlayMessages.GET_LOGS:
            return { success: true, logs: getTogglePlayLogs() };

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
