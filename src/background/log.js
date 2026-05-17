var togglePlayLogBuffer = [];
var MAX_LOGS = 1000;

async function _persistLogs() {
  try {
    await chrome.storage.session.set({ togglePlayLogs: togglePlayLogBuffer });
  } catch (e) {}
}

function storeLog(level, str) {
  var entry = new Date().toISOString() + ' [' + level.toUpperCase() + '] ' + str;
  togglePlayLogBuffer.push(entry);
  if (togglePlayLogBuffer.length > MAX_LOGS) {
    togglePlayLogBuffer.shift();
  }
  _persistLogs();
}

function togglePlayLog(message) {
  var args = Array.prototype.slice.call(arguments, 1);
  var str = '[TogglePlay Background] ' + message + ' ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
  console.log.apply(console, ['[TogglePlay Background]'].concat([message], args));
  storeLog('info', str);
}

function togglePlayError(message) {
  var args = Array.prototype.slice.call(arguments, 1);
  var str = '[TogglePlay Background ERROR] ' + message + ' ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
  console.error.apply(console, ['[TogglePlay Background ERROR]'].concat([message], args));
  storeLog('error', str);
}

function handleRemoteLog(level, message) {
  storeLog(level, message);
}

async function loadPersistedLogs() {
  try {
    var data = await chrome.storage.session.get(['togglePlayLogs']);
    if (data && data.togglePlayLogs) {
      togglePlayLogBuffer = data.togglePlayLogs;
    }
  } catch (e) {}
}

function getTogglePlayLogs() {
  return togglePlayLogBuffer;
}
