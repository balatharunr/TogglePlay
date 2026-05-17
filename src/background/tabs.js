async function sendMessageToTab(tabId, message) {
  try {
    await chrome.tabs.get(tabId);
    var response = await chrome.tabs.sendMessage(tabId, message);
    togglePlayLog('Message sent to tab ' + tabId + ':', message.type);
    return response;
  } catch (err) {
    if (err.message && (
      err.message.includes('Extension context invalidated') ||
      err.message.includes('No tab with id') ||
      err.message.includes('Receiving end does not exist')
    )) {
      togglePlayLog('Tab ' + tabId + ' no longer available, skipping');
      return null;
    }
    togglePlayError('Failed to send message to tab ' + tabId + ':', err);
    throw err;
  }
}

async function getYouTubeTabs() {
  try {
    var tabs = await chrome.tabs.query({
      url: ['https://www.youtube.com/*', 'https://youtube.com/*']
    });
    var videoTabs = tabs.filter(function (tab) {
      return TogglePlayPlatforms.isYouTubeUrl(tab.url);
    });
    togglePlayLog('Found YouTube tabs:', videoTabs.length);
    return videoTabs;
  } catch (err) {
    togglePlayError('Failed to get YouTube tabs:', err);
    return [];
  }
}

async function getSpotifyTabs() {
  try {
    var tabs = await chrome.tabs.query({
      url: ['https://open.spotify.com/*']
    });
    togglePlayLog('Found Spotify tabs:', tabs.length);
    return tabs;
  } catch (err) {
    togglePlayError('Failed to get Spotify tabs:', err);
    return [];
  }
}

async function getYTMusicTabs() {
  try {
    var tabs = await chrome.tabs.query({
      url: ['https://music.youtube.com/*']
    });
    togglePlayLog('Found YouTube Music tabs:', tabs.length);
    return tabs;
  } catch (err) {
    togglePlayError('Failed to get YouTube Music tabs:', err);
    return [];
  }
}

async function getAllMediaTabs() {
  try {
    var results = await Promise.all([
      getYouTubeTabs(),
      getYTMusicTabs(),
      getSpotifyTabs()
    ]);
    var youtubeTabs = results[0];
    var ytmusicTabs = results[1];
    var spotifyTabs = results[2];

    var allTabs = youtubeTabs.map(function (tab) {
      return Object.assign({}, tab, { sourceType: 'youtube' });
    }).concat(
      ytmusicTabs.map(function (tab) {
        return Object.assign({}, tab, { sourceType: 'ytmusic' });
      }),
      spotifyTabs.map(function (tab) {
        return Object.assign({}, tab, { sourceType: 'spotify' });
      })
    );

    togglePlayLog('Found total media tabs:', allTabs.length);
    return allTabs;
  } catch (err) {
    togglePlayError('Failed to get all media tabs:', err);
    return [];
  }
}
