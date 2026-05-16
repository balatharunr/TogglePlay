function togglePlayLog(message) {
  var args = Array.prototype.slice.call(arguments, 1);
  console.log.apply(console, ['[TogglePlay Background]'].concat([message], args));
}

function togglePlayError(message) {
  var args = Array.prototype.slice.call(arguments, 1);
  console.error.apply(console, ['[TogglePlay Background]'].concat([message], args));
}
