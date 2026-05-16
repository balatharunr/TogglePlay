/**
 * TogglePlay — background service worker entry point.
 */
importScripts(
  '../shared/config.js',
  '../shared/platforms.js',
  './log.js',
  './state.js',
  './tabs.js',
  './pairing.js',
  './playback-sync.js',
  './message-handler.js'
);

registerBackgroundMessageHandler();
togglePlayLog('Background script loaded');
