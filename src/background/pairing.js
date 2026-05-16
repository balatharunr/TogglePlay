async function addPair(tabId1, tabId2) {
  try {
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
    return { success: true };
  } catch (err) {
    togglePlayError('Failed to add pair:', err);
    return { success: false, error: err.message };
  }
}
