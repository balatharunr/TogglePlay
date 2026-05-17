async function addPair(tabId1, tabId2) {
  try {
    tabId1 = TogglePlayStorageSerializers.normalizeTabId(tabId1);
    tabId2 = TogglePlayStorageSerializers.normalizeTabId(tabId2);
    togglePlayLog('Adding pair:', tabId1, '↔', tabId2);

    var tabResults = await Promise.all([
      chrome.tabs.get(tabId1),
      chrome.tabs.get(tabId2)
    ]);
    var tab1 = tabResults[0];
    var tab2 = tabResults[1];

    var sourceType1 = TogglePlayPlatforms.getSourceType(tab1.url);
    var sourceType2 = TogglePlayPlatforms.getSourceType(tab2.url);

    togglePlayBackgroundState.pairs.clear();

    togglePlayBackgroundState.pairs.set(tabId1, {
      pairedWith: [{ tabId: tabId2, title: tab2.title, url: tab2.url, sourceType: sourceType2 }],
      title: tab1.title,
      url: tab1.url,
      sourceType: sourceType1
    });

    togglePlayBackgroundState.pairs.set(tabId2, {
      pairedWith: [{ tabId: tabId1, title: tab1.title, url: tab1.url, sourceType: sourceType1 }],
      title: tab2.title,
      url: tab2.url,
      sourceType: sourceType2
    });

    togglePlayLog('Pair added successfully:', sourceType1, '↔', sourceType2);
    await persistBackgroundState({ pairs: true });
    return { success: true };
  } catch (err) {
    togglePlayError('Failed to add pair:', err);
    return { success: false, error: err.message };
  }
}

async function updatePairMetadata(tabId, title, url) {
  var state = togglePlayBackgroundState;
  tabId = TogglePlayStorageSerializers.normalizeTabId(tabId);
  var pairInfo = state.pairs.get(tabId);
  if (!pairInfo) return;

  var changed = false;
  if (title && pairInfo.title !== title) {
    pairInfo.title = title;
    changed = true;
  }
  if (url && pairInfo.url !== url) {
    pairInfo.url = url;
    changed = true;
  }

  if (changed) {
    if (pairInfo.pairedWith) {
      pairInfo.pairedWith.forEach(function(partner) {
        var partnerId = partner.tabId;
        var partnerInfo = state.pairs.get(partnerId);
        if (partnerInfo && partnerInfo.pairedWith) {
          partnerInfo.pairedWith.forEach(function(p) {
            if (p.tabId === tabId) {
              if (title) p.title = title;
              if (url) p.url = url;
            }
          });
        }
      });
    }

    await persistBackgroundState({ pairs: true });
    togglePlayLog('Updated pair metadata for tab', tabId, '->', title);
    chrome.runtime.sendMessage({ type: 'PAIRS_UPDATED' }).catch(function(){});
  }
}