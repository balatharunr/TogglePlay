/**
 * Auto-inject content scripts when the extension is updated or reloaded.
 * This prevents the "have to refresh tabs" annoyance.
 */
async function injectContentScripts() {
  if (!chrome.scripting) return;

  try {
    var manifest = chrome.runtime.getManifest();
    var contentScripts = manifest.content_scripts;
    if (!contentScripts) return;

    for (var i = 0; i < contentScripts.length; i++) {
      var cs = contentScripts[i];
      var matches = cs.matches;
      var jsFiles = cs.js;
      
      var tabs = await chrome.tabs.query({ url: matches });
      for (var j = 0; j < tabs.length; j++) {
        var tab = tabs[j];
        // Only inject into regular web pages, avoid chrome:// etc.
        if (tab.url && tab.url.startsWith('http')) {
          try {
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: jsFiles
            });
            togglePlayLog('Auto-injected scripts into tab', tab.id);
          } catch (err) {
            // Ignore errors for tabs we can't inject into
          }
        }
      }
    }
  } catch (e) {
    togglePlayError('Failed to auto-inject content scripts', e);
  }
}

chrome.runtime.onInstalled.addListener(function () {
  togglePlayLog('Extension installed/updated. Auto-injecting content scripts...');
  injectContentScripts();
});
