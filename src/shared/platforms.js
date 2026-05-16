/**
 * Platform detection and display helpers (YouTube, YouTube Music, Spotify).
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

  /** Loose URL → platform label (pairing, tab metadata). */
  function getSourceType(url) {
    if (!url) return null;
    if (url.includes('music.youtube.com')) return 'ytmusic';
    if (url.includes('open.spotify.com')) return 'spotify';
    if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
    return null;
  }

  function getSourceIcon(sourceType) {
    if (sourceType === 'youtube') return '▶️';
    if (sourceType === 'ytmusic') return '🎧';
    if (sourceType === 'spotify') return '🎵';
    return '🎶';
  }

  return {
    isYouTubeUrl,
    isYTMusicUrl,
    isSpotifyUrl,
    isMediaUrl,
    getSourceType,
    getSourceIcon
  };
})();
