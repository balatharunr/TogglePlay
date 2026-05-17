/**
 * Serialize Map/Set for chrome.storage (JSON-only).
 */
var TogglePlayStorageSerializers = (function () {
  'use strict';

  function setToArray(set) {
    return set ? Array.from(set) : [];
  }

  function arrayToSet(arr) {
    return new Set(Array.isArray(arr) ? arr : []);
  }

  function mapToEntries(map) {
    if (!map || typeof map.entries !== 'function') {
      return [];
    }
    return Array.from(map.entries());
  }

  function entriesToMap(entries) {
    var map = new Map();
    if (!Array.isArray(entries)) {
      return map;
    }
    entries.forEach(function (entry) {
      if (entry && entry.length >= 2) {
        map.set(entry[0], entry[1]);
      }
    });
    return map;
  }

  return {
    setToArray: setToArray,
    arrayToSet: arrayToSet,
    mapToEntries: mapToEntries,
    entriesToMap: entriesToMap
  };
})();
