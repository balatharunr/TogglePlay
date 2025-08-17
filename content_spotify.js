// Content script for Spotify
let isMonitoring = false;
let lastPlayState = false;
let checkInterval;
let isHandlingToggle = false; // Prevent infinite loops

function initSpotifyMonitoring() {
  if (isMonitoring) return;
  isMonitoring = true;
  
  // Function to get play/pause button
  function getPlayButton() {
    // Try different selectors for Spotify's play button
    return document.querySelector('[data-testid="control-button-playpause"]') ||
           document.querySelector('.player-controls__buttons button[title*="pause"], .player-controls__buttons button[title*="play"]') ||
           document.querySelector('.spoticon-play-16, .spoticon-pause-16') ||
           document.querySelector('[aria-label*="Play"], [aria-label*="Pause"]');
  }
  
  // Function to check if music is playing
  function isPlaying() {
    const playButton = getPlayButton();
    if (!playButton) return false;
    
    // Check various indicators that music is playing
    const isPaused = playButton.getAttribute('aria-label')?.toLowerCase().includes('play') ||
                    playButton.title?.toLowerCase().includes('play') ||
                    playButton.querySelector('.spoticon-play-16') ||
                    playButton.classList.contains('spoticon-play-16');
    
    return !isPaused;
  }
  
  // Function to get current track info
  function getCurrentTrackInfo() {
    const trackName = document.querySelector('[data-testid="now-playing-widget"] a[data-testid="context-item-link"], .now-playing__name, .track-info__name') ||
                     document.querySelector('.Root__now-playing-bar .track-info__name a');
    
    const artistName = document.querySelector('[data-testid="now-playing-widget"] span[data-testid="context-item-info-artist"], .now-playing__artist, .track-info__artists') ||
                      document.querySelector('.Root__now-playing-bar .track-info__artists a');
    
    return {
      track: trackName ? trackName.textContent.trim() : 'Unknown Track',
      artist: artistName ? artistName.textContent.trim() : 'Unknown Artist'
    };
  }
  
  // Function to check play state and notify background
  function checkPlayState() {
    // Skip if we're currently handling a toggle to prevent loops
    if (isHandlingToggle) return;
    
    const currentlyPlaying = isPlaying();
    
    if (currentlyPlaying !== lastPlayState) {
      lastPlayState = currentlyPlaying;
      
      // Check if extension context is still valid before sending message
      if (chrome.runtime && chrome.runtime.id) {
        try {
          chrome.runtime.sendMessage({
            action: 'mediaStateChanged',
            isPlaying: currentlyPlaying,
            mediaType: 'audio',
            platform: 'spotify'
          }).catch(() => {
            // Silently ignore context invalidation errors
          });
        } catch (error) {
          // Extension context invalidated, stop monitoring
          console.log('Extension context invalidated, stopping monitoring');
          return;
        }
      }
    }
  }
  
  // Function to toggle play/pause
  function togglePlayPause() {
    const playButton = getPlayButton();
    if (playButton) {
      playButton.click();
      return true;
    }
    return false;
  }
  
  // Function to play media
  function playMedia() {
    if (!isPlaying()) {
      return togglePlayPause();
    }
    return false;
  }
  
  // Function to pause media
  function pauseMedia() {
    if (isPlaying()) {
      return togglePlayPause();
    }
    return false;
  }
  
  // Set up monitoring
  function setupMonitoring() {
    // Clear any existing interval
    if (checkInterval) {
      clearInterval(checkInterval);
    }
    
    // Monitor play state changes
    checkInterval = setInterval(checkPlayState, 1000);
    
    // Also listen for click events on play/pause button
    const playButton = getPlayButton();
    if (playButton) {
      playButton.addEventListener('click', () => {
        setTimeout(checkPlayState, 100);
      });
    }
    
    // Initial state check
    setTimeout(checkPlayState, 500);
  }
  
  // Set up monitoring when page loads
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(setupMonitoring, 2000);
    });
  } else {
    setTimeout(setupMonitoring, 2000);
  }
  
  // Monitor for DOM changes (Spotify is SPA)
  new MutationObserver(() => {
    if (!getPlayButton()) {
      setTimeout(setupMonitoring, 1000);
    }
  }).observe(document.body, { subtree: true, childList: true });
  
  // Periodically re-setup monitoring
  setInterval(() => {
    if (!getPlayButton()) {
      setTimeout(setupMonitoring, 1000);
    }
  }, 10000);
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Check if extension context is still valid
  if (!chrome.runtime || !chrome.runtime.id) {
    return;
  }
  
  try {
    if (message.action === 'pauseMedia') {
      isHandlingToggle = true;
      pauseMedia();
      // Reset flag after a short delay
      setTimeout(() => { isHandlingToggle = false; }, 500);
    } else if (message.action === 'playMedia') {
      isHandlingToggle = true;
      playMedia();
      // Reset flag after a short delay
      setTimeout(() => { isHandlingToggle = false; }, 500);
    } else if (message.action === 'getMediaInfo') {
      const trackInfo = getCurrentTrackInfo();
      sendResponse({
        isPlaying: isPlaying(),
        title: `${trackInfo.track} - ${trackInfo.artist}`,
        platform: 'spotify'
      });
    }
  } catch (error) {
    // Silently handle extension context invalidation
    console.log('Extension context error:', error.message);
  }
});

// Initialize monitoring
initSpotifyMonitoring();