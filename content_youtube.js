// Content script for YouTube
let isMonitoring = false;
let lastPlayState = false;
let isHandlingToggle = false; // Prevent infinite loops

function initYouTubeMonitoring() {
  if (isMonitoring) return;
  isMonitoring = true;
  
  // Function to get video element
  function getVideoElement() {
    return document.querySelector('video');
  }
  
  // Function to check play state and notify background
  function checkPlayState() {
    // Skip if we're currently handling a toggle to prevent loops
    if (isHandlingToggle) return;
    
    const video = getVideoElement();
    if (!video) return;
    
    const isPlaying = !video.paused && !video.ended;
    
    if (isPlaying !== lastPlayState) {
      lastPlayState = isPlaying;
      
      // Check if extension context is still valid before sending message
      if (chrome.runtime && chrome.runtime.id) {
        try {
          chrome.runtime.sendMessage({
            action: 'mediaStateChanged',
            isPlaying: isPlaying,
            mediaType: 'video',
            platform: 'youtube'
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
  
  // Monitor video state changes
  function setupVideoMonitoring() {
    const video = getVideoElement();
    if (video) {
      video.addEventListener('play', checkPlayState);
      video.addEventListener('pause', checkPlayState);
      video.addEventListener('ended', checkPlayState);
      
      // Initial state check
      setTimeout(checkPlayState, 500);
    }
  }
  
  // Set up monitoring when page loads
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(setupVideoMonitoring, 1000);
    });
  } else {
    setTimeout(setupVideoMonitoring, 1000);
  }
  
  // Also monitor for navigation changes (YouTube is SPA)
  let lastUrl = location.href;
  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      setTimeout(setupVideoMonitoring, 2000);
    }
  }).observe(document, { subtree: true, childList: true });
  
  // Periodically check for video element (in case it's dynamically loaded)
  setInterval(() => {
    if (!getVideoElement()) {
      setTimeout(setupVideoMonitoring, 1000);
    }
  }, 5000);
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
      const video = document.querySelector('video');
      if (video && !video.paused) {
        video.pause();
      }
      // Reset flag after a short delay
      setTimeout(() => { isHandlingToggle = false; }, 500);
    } else if (message.action === 'playMedia') {
      isHandlingToggle = true;
      const video = document.querySelector('video');
      if (video && video.paused && !video.ended) {
        // Try to play the video
        video.play().catch((error) => {
          console.log('Autoplay prevented:', error);
          // If autoplay is prevented, we can't force it due to browser restrictions
        });
      }
      // Reset flag after a short delay
      setTimeout(() => { isHandlingToggle = false; }, 500);
    } else if (message.action === 'getMediaInfo') {
      const video = document.querySelector('video');
      const title = document.querySelector('h1.title yt-formatted-string, #title h1, .title.style-scope.ytd-video-primary-info-renderer') || 
                   document.querySelector('title');
      
      sendResponse({
        isPlaying: video ? !video.paused && !video.ended : false,
        title: title ? title.textContent.trim() : 'YouTube Video',
        platform: 'youtube'
      });
    }
  } catch (error) {
    // Silently handle extension context invalidation
    console.log('Extension context error:', error.message);
  }
});

// Initialize monitoring
initYouTubeMonitoring();