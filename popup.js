// Popup script for TogglePlay extension
let currentTab = null;
let selectedSecondTab = null;
let availableTabs = [];
let togglePairs = [];
let isToggleEnabled = false;

document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  await loadCurrentTab();
  await loadAvailableTabs();
  setupEventListeners();
  updateUI();
});

async function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['togglePairs', 'isToggleEnabled'], (result) => {
      togglePairs = result.togglePairs || [];
      isToggleEnabled = result.isToggleEnabled || false;
      resolve();
    });
  });
}

async function loadCurrentTab() {
  try {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!activeTab) {
      showCurrentTabError('No active tab found');
      return;
    }

    // Check if current tab is YouTube or Spotify
    const isValidTab = activeTab.url.includes('youtube.com') || 
                      activeTab.url.includes('youtu.be') || 
                      activeTab.url.includes('spotify.com');
    
    if (!isValidTab) {
      showCurrentTabError('Current tab must be YouTube or Spotify');
      return;
    }

    // Get media info from the current tab
    let mediaInfo = { title: 'Loading...', platform: 'unknown' };
    try {
      mediaInfo = await new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(activeTab.id, { action: 'getMediaInfo' }, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response || { title: 'Loading...', platform: 'unknown' });
          }
        });
      });
    } catch (error) {
      // If content script not ready, use URL-based info
      if (activeTab.url.includes('youtube.com') || activeTab.url.includes('youtu.be')) {
        mediaInfo = { title: activeTab.title || 'YouTube Video', platform: 'youtube' };
      } else if (activeTab.url.includes('spotify.com')) {
        mediaInfo = { title: activeTab.title || 'Spotify Music', platform: 'spotify' };
      }
    }

    currentTab = {
      id: activeTab.id,
      url: activeTab.url,
      title: mediaInfo.title,
      platform: mediaInfo.platform
    };

    updateCurrentTabDisplay();
    
  } catch (error) {
    console.error('Error loading current tab:', error);
    showCurrentTabError('Error loading current tab');
  }
}

async function loadAvailableTabs() {
  try {
    const allTabs = await chrome.tabs.query({ currentWindow: true });
    
    availableTabs = allTabs.filter(tab => {
      // Exclude current tab and filter for YouTube/Spotify
      const isCurrentTab = currentTab && tab.id === currentTab.id;
      const isValidTab = tab.url.includes('youtube.com') || 
                        tab.url.includes('youtu.be') || 
                        tab.url.includes('spotify.com');
      
      return !isCurrentTab && isValidTab;
    }).map(tab => ({
      id: tab.id,
      url: tab.url,
      title: tab.title,
      platform: tab.url.includes('spotify.com') ? 'spotify' : 'youtube'
    }));

    updateAvailableTabsDisplay();
    
  } catch (error) {
    console.error('Error loading available tabs:', error);
    document.getElementById('availableTabs').innerHTML = 
      '<div class="loading-message">Error loading tabs</div>';
  }
}

function setupEventListeners() {
  // Toggle switch
  const enableToggle = document.getElementById('enableToggle');
  enableToggle.addEventListener('change', (e) => {
    isToggleEnabled = e.target.checked;
    saveSettings();
  });

  // Available tabs selection
  document.getElementById('availableTabs').addEventListener('click', (e) => {
    const tabItem = e.target.closest('.available-tab-item');
    if (tabItem) {
      const tabId = parseInt(tabItem.dataset.tabId);
      selectSecondTab(tabId);
    }
  });
}

function selectSecondTab(tabId) {
  selectedSecondTab = availableTabs.find(tab => tab.id === tabId);
  
  // Update visual selection
  document.querySelectorAll('.available-tab-item').forEach(item => {
    item.classList.remove('selected');
  });
  
  const selectedItem = document.querySelector(`[data-tab-id="${tabId}"]`);
  if (selectedItem) {
    selectedItem.classList.add('selected');
  }

  // Automatically create the pair
  if (currentTab && selectedSecondTab) {
    createTogglePair();
  }
}

async function createTogglePair() {
  if (!currentTab || !selectedSecondTab) {
    showError('Please select a second tab');
    return;
  }

  if (currentTab.id === selectedSecondTab.id) {
    showError('Cannot pair a tab with itself');
    return;
  }

  // Check if either tab is already in a pair
  const existingPair = togglePairs.find(pair => 
    pair.tab1.id === currentTab.id || pair.tab1.id === selectedSecondTab.id ||
    pair.tab2.id === currentTab.id || pair.tab2.id === selectedSecondTab.id
  );

  if (existingPair) {
    showError('One of the selected tabs is already in a toggle pair');
    return;
  }

  // Add new pair
  const newPair = {
    id: Date.now().toString(),
    tab1: { ...currentTab },
    tab2: { ...selectedSecondTab },
    created: new Date().toISOString()
  };

  togglePairs.push(newPair);
  
  // Automatically enable toggle functionality
  isToggleEnabled = true;
  document.getElementById('enableToggle').checked = true;
  
  await saveSettings();

  // Reset selection
  selectedSecondTab = null;
  await loadAvailableTabs(); // Refresh available tabs
  updateTogglePairsList();

  showSuccess('Toggle pair created and enabled! Start playing media in either tab.');
}

async function removePair(pairId) {
  togglePairs = togglePairs.filter(pair => pair.id !== pairId);
  await saveSettings();
  await loadAvailableTabs(); // Refresh available tabs
  updateTogglePairsList();
  showSuccess('Toggle pair removed');
}

function updateCurrentTabDisplay() {
  const container = document.getElementById('currentTab');
  
  if (!currentTab) {
    container.innerHTML = '<div class="current-tab-invalid">Please open a YouTube or Spotify tab</div>';
    return;
  }

  const titleElement = container.querySelector('.tab-title');
  const urlElement = container.querySelector('.tab-url');
  
  if (titleElement && urlElement) {
    titleElement.textContent = currentTab.title;
    urlElement.textContent = new URL(currentTab.url).hostname;
    container.classList.add('selected');
  }
}

function updateAvailableTabsDisplay() {
  const container = document.getElementById('availableTabs');
  
  if (availableTabs.length === 0) {
    container.innerHTML = '<div class="no-available-tabs">No other YouTube or Spotify tabs found.<br>Open another tab to create a toggle pair.</div>';
    return;
  }

  container.innerHTML = availableTabs.map(tab => `
    <div class="available-tab-item" data-tab-id="${tab.id}">
      <span class="available-tab-title">${escapeHtml(tab.title)}</span>
      <span class="available-tab-url">${escapeHtml(new URL(tab.url).hostname)} (${tab.platform})</span>
    </div>
  `).join('');
}

function showCurrentTabError(message) {
  const container = document.getElementById('currentTab');
  container.innerHTML = `<div class="current-tab-invalid">${message}</div>`;
}

function updateTogglePairsList() {
  const container = document.getElementById('togglePairs');
  
  if (togglePairs.length === 0) {
    container.innerHTML = '<div class="no-pairs">No toggle pairs configured</div>';
    return;
  }

  container.innerHTML = togglePairs.map(pair => `
    <div class="pair-item">
      <div class="pair-tabs">
        <div class="pair-tab">
          <span class="pair-tab-title">${escapeHtml(pair.tab1.title)}</span>
          <span class="pair-tab-url">${escapeHtml(new URL(pair.tab1.url).hostname)}</span>
        </div>
        <div class="pair-arrow">⇄</div>
        <div class="pair-tab">
          <span class="pair-tab-title">${escapeHtml(pair.tab2.title)}</span>
          <span class="pair-tab-url">${escapeHtml(new URL(pair.tab2.url).hostname)}</span>
        </div>
      </div>
      <button class="remove-pair-btn" onclick="removePair('${pair.id}')">Remove</button>
    </div>
  `).join('');
}

function updateUI() {
  // Update toggle switch
  document.getElementById('enableToggle').checked = isToggleEnabled;
  
  // Update toggle pairs list
  updateTogglePairsList();
}

async function saveSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.set({ 
      togglePairs, 
      isToggleEnabled 
    }, () => {
      // Also notify background script
      chrome.runtime.sendMessage({
        action: 'updateSettings',
        togglePairs,
        isToggleEnabled
      }, () => {
        resolve();
      });
    });
  });
}

function showError(message) {
  showNotification(message, 'error');
}

function showSuccess(message) {
  showNotification(message, 'success');
}

function showNotification(message, type) {
  // Remove existing notifications
  const existing = document.querySelector('.notification');
  if (existing) {
    existing.remove();
  }

  // Create notification
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  
  // Add styles
  notification.style.cssText = `
    position: fixed;
    top: 10px;
    left: 50%;
    transform: translateX(-50%);
    padding: 10px 20px;
    border-radius: 4px;
    color: white;
    font-weight: 500;
    z-index: 1000;
    animation: slideDown 0.3s ease-out;
    ${type === 'error' ? 'background-color: #dc3545;' : 'background-color: #28a745;'}
  `;

  document.body.appendChild(notification);

  // Remove after 3 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.remove();
    }
  }, 3000);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Make removePair function globally available
window.removePair = removePair;