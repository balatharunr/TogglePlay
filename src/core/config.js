/**
 * Extension-wide configuration constants.
 */
var TogglePlayConfig = {
  STORAGE_KEYS: {
    ENABLED: 'togglePlayEnabled',
    SYNC_MODE: 'togglePlaySyncMode',
    PAIRS_SESSION: 'togglePlayPairsSession'
  },
  SYNC_MODES: {
    EXCLUSIVE: 'exclusive',
    MIRROR: 'mirror'
  },
  DEFAULT_SYNC_MODE: 'exclusive',
  DEBOUNCE_MS: {
    YOUTUBE: 300,
    YTMUSIC: 150,
    SPOTIFY: 300
  },
  CONTROLLED_TAB_TIMEOUT_MS: 1000,
  PAUSE_BOTH_SETTLE_MS: 500
};
