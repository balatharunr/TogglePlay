document.addEventListener('DOMContentLoaded', () => {
  const closeBtn = document.getElementById('closeBtn');
  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      
      // Try to close the tab using Chrome Extension API if available
      if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.getCurrent) {
        chrome.tabs.getCurrent((tab) => {
          if (tab && tab.id) {
            chrome.tabs.remove(tab.id);
          } else {
            window.close();
          }
        });
      } else {
        // Fallback for normal browser context
        window.close();
      }
    });
  }
});
