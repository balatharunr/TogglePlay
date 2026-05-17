/**
 * TogglePlay — background service worker entry point.
 */
importScripts(
  '../shared/config.js',
  '../shared/messages.js',
  '../shared/storage-serializers.js',
  '../shared/platforms.js',
  './log.js',
  './state.js',
  './storage.js',
  './hydration.js',
  './sync-modes.js',
  './tabs.js',
  './pairing.js',
  './playback-sync.js',
  './tab-lifecycle.js',
  './message-handler.js'
);

registerBackgroundMessageHandler();
registerTabLifecycleListeners();

chrome.runtime.onStartup.addListener(function () {
  togglePlayHydrationPromise = null;
  ensureHydrated();
});

chrome.runtime.onInstalled.addListener(function () {
  togglePlayHydrationPromise = null;
  ensureHydrated();
});

ensureHydrated();
togglePlayLog('Background script loaded');
