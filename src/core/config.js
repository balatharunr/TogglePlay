/**
 * Extension-wide configuration constants.
 */
var TogglePlayConfig = {
  STORAGE_KEYS: {
    ENABLED: 'togglePlayEnabled',
    EXCLUSIVE_MODE: 'togglePlayExclusiveMode',
    /** @deprecated migrated to EXCLUSIVE_MODE */
    SYNC_MODE: 'togglePlaySyncMode',
    PAIRS_SESSION: 'togglePlayPairsSession'
  },
  DEBOUNCE_MS: {
    YOUTUBE: 300,
    YTMUSIC: 150,
    SPOTIFY: 300
  },
  CONTROLLED_TAB_TIMEOUT_MS: 1000,
  PAUSE_BOTH_SETTLE_MS: 500
};
