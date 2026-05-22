/**
 * Clean up pairs when tabs close or navigate away from media URLs.
 */
function registerTabLifecycleListeners() {
  chrome.tabs.onRemoved.addListener(function (tabId) {
    removePairsInvolvingTab(tabId);
    chrome.runtime.sendMessage({ type: 'TABS_UPDATED' }).catch(function(){});
  });
  chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
    if (!tab.url || !tab.title) {
      return;
    }

    var isMedia = TogglePlayPlatforms.getSourceType(tab.url);
    if (!isMedia) {
      return;
    }

    if (changeInfo.title && typeof updatePairMetadata === 'function') {
      updatePairMetadata(tabId, tab.title, tab.url);
    }

    // URL changes can add/remove tabs from the list; title-only updates are silent.
    if (changeInfo.url) {
      chrome.runtime.sendMessage({ type: 'TABS_UPDATED' }).catch(function () {});
    }
  });
}

async function removePairsInvolvingTab(tabId) {
  var state = togglePlayBackgroundState;
  tabId = TogglePlayStorageSerializers.normalizeTabId(tabId);
  if (!hasPairForTab(tabId)) {
    return;
  }

  var pairInfo = getPairForTab(tabId);
  var partnerIds = [];

  if (pairInfo && pairInfo.pairedWith) {
    pairInfo.pairedWith.forEach(function (partner) {
      partnerIds.push(TogglePlayStorageSerializers.normalizeTabId(partner.tabId));
    });
  }

  state.pairs.delete(tabId);
  partnerIds.forEach(function (partnerId) {
    state.pairs.delete(partnerId);
  });

  await saveSessionPairs(state.pairs);
  togglePlayLog('Removed pair(s) involving closed or invalid tab', tabId);
  chrome.runtime.sendMessage({ type: 'PAIRS_UPDATED' }).catch(function(){});
}
