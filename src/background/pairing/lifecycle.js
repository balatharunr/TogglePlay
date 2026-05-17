/**
 * Clean up pairs when tabs close or navigate away from media URLs.
 */
function registerTabLifecycleListeners() {
  chrome.tabs.onRemoved.addListener(function (tabId) {
    removePairsInvolvingTab(tabId);
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
}
