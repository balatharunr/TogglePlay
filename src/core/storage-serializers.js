/**
 * Serialize Map/Set for chrome.storage (JSON-only).
 */
var TogglePlayStorageSerializers = (function () {
  'use strict';

  function normalizeTabId(id) {
    if (id === null || id === undefined) {
      return id;
    }
    var n = Number(id);
    return Number.isNaN(n) ? id : n;
  }

  function normalizePairInfo(pairInfo) {
    if (!pairInfo || !pairInfo.pairedWith) {
      return pairInfo;
    }
    return Object.assign({}, pairInfo, {
      pairedWith: pairInfo.pairedWith.map(function (partner) {
        return Object.assign({}, partner, {
          tabId: normalizeTabId(partner.tabId)
        });
      })
    });
  }

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
        map.set(normalizeTabId(entry[0]), normalizePairInfo(entry[1]));
      }
    });
    return map;
  }

  return {
    normalizeTabId: normalizeTabId,
    normalizePairInfo: normalizePairInfo,
    setToArray: setToArray,
    arrayToSet: arrayToSet,
    mapToEntries: mapToEntries,
    entriesToMap: entriesToMap
  };
})();
