/**
 * Platform detection and display helpers (YouTube, YouTube Music, Spotify).
 *
 * Supported YouTube media URL patterns (for tab discovery / pairing):
 *   - https://www.youtube.com/watch?v=...
 *   - https://youtube.com/watch?v=...
 *   - https://www.youtube.com/shorts/...
 *   - https://www.youtube.com/embed/...
 *   - https://youtu.be/...
 */
var TogglePlayPlatforms = (function () {
  'use strict';

  function isYouTubeUrl(url) {
    return url && !url.includes('music.youtube.com') && (
      url.includes('youtube.com/watch') ||
      url.includes('youtu.be/') ||
      (url.includes('youtube.com') && (
        url.includes('/watch?') ||
        url.includes('/shorts/') ||
        url.includes('/embed/')
      ))
    );
  }

  function isYTMusicUrl(url) {
    return url && url.includes('music.youtube.com');
  }

  function isSpotifyUrl(url) {
    return url && url.includes('open.spotify.com');
  }

  function isMediaUrl(url) {
    return isYouTubeUrl(url) || isYTMusicUrl(url) || isSpotifyUrl(url);
  }

  /** Alias for background tab listing (same rules as isYouTubeUrl). */
  function isYouTubeMediaTab(url) {
    return isYouTubeUrl(url);
  }

  /** Loose URL → platform label (pairing, tab metadata). */
  function getSourceType(url) {
    if (!url) return null;
    if (url.includes('music.youtube.com')) return 'ytmusic';
    if (url.includes('open.spotify.com')) return 'spotify';
    if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
    return null;
  }

  function getSourceIcon(sourceType) {
    const s = 'style="vertical-align:-3px;flex-shrink:0"';
    if (sourceType === 'youtube') return `<svg ${s} width="16" height="16" viewBox="0 0 24 24" fill="none"><rect width="24" height="24" rx="4" fill="#FF0000"/><path d="M9.5 7.5v9l7-4.5-7-4.5z" fill="#fff"/></svg>`;
    if (sourceType === 'ytmusic') return `<svg ${s} width="16" height="16" viewBox="0 0 24 24" fill="none"><rect width="24" height="24" rx="4" fill="#FF0000"/><circle cx="12" cy="12" r="4" stroke="#fff" stroke-width="1.5" fill="none"/><path d="M14.5 12l-3.5 2V10l3.5 2z" fill="#fff"/><circle cx="12" cy="12" r="8" stroke="#fff" stroke-width="1.5" fill="none"/></svg>`;
    if (sourceType === 'spotify') return `<svg ${s} width="16" height="16" viewBox="0 0 24 24" fill="none"><rect width="24" height="24" rx="4" fill="#1DB954"/><path d="M16.5 10.5c-2.8-1.6-7.2-1.8-9.8-1 -.4.1-.7-.1-.8-.5s.1-.7.5-.8c3-.9 7.9-.7 11 1.1.4.2.5.7.3 1-.2.3-.6.4-1 .2zm-.7 2.4c-2.3-1.4-5.8-1.8-8.5-1-.3.1-.7 0-.8-.4-.1-.3 0-.7.4-.8 3.1-1 6.9-.5 9.5 1.1.3.2.4.6.2 1-.2.2-.6.3-.9.1zm-1 2.3c-1.9-1.1-4.3-1.4-7-1-.3 0-.5-.1-.6-.4 0-.3.1-.5.4-.6 3-.5 5.7-.2 7.8 1 .3.1.3.5.2.7-.2.3-.5.4-.8.2z" fill="#fff"/></svg>`;
    return `<svg ${s} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`;
  }

  return {
    isYouTubeUrl,
    isYouTubeMediaTab,
    isYTMusicUrl,
    isSpotifyUrl,
    isMediaUrl,
    getSourceType,
    getSourceIcon
  };
})();
