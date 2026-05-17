/**
 * TogglePlay — background service worker entry point.
 */
importScripts(
  '../core/config.js',
  '../core/messages.js',
  '../core/storage-serializers.js',
  '../core/platforms.js',
  './log.js',
  './state/background-state.js',
  './persistence/storage.js',
  './state/hydration.js',
  './sync/modes.js',
  './tabs.js',
  './state/pair-lookups.js',
  './pairing/pairs.js',
  './sync/playback.js',
  './pairing/lifecycle.js',
  './messaging/handler.js'
);

registerBackgroundMessageHandler();
registerTabLifecycleListeners();

chrome.runtime.onStartup.addListener(function () {
  togglePlayBackgroundState.hydrated = false;
  togglePlayHydrationPromise = null;
  ensureHydrated();
});

ensureHydrated();
togglePlayLog('Background script loaded');
