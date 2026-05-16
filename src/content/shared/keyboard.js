/**
 * Shared "B" keyboard shortcut — pause both paired tabs.
 */
function setupPauseBothShortcut(state, sendMessage, logger, options) {
  options = options || {};

  document.addEventListener('keydown', async function (event) {
    if (!TogglePlayContent.isContextValid()) {
      TogglePlayContent.markContextInvalid(state);
      return;
    }

    var tag = event.target.tagName;
    var blockedTags = options.blockedTags || ['INPUT', 'TEXTAREA'];
    var isBlockedTag = blockedTags.indexOf(tag) !== -1;
    var isSearchRole = event.target.getAttribute &&
      event.target.getAttribute('role') &&
      event.target.getAttribute('role').includes('search');

    if (event.key.toLowerCase() !== 'b' ||
      event.ctrlKey || event.altKey || event.metaKey ||
      isBlockedTag ||
      event.target.isContentEditable ||
      isSearchRole) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    logger.log('B key pressed - pausing both tabs');

    if (typeof options.onLocalPause === 'function') {
      options.onLocalPause();
    }

    try {
      var response = await sendMessage({ type: 'PAUSE_BOTH' });
      if (response && response.success) {
        logger.log('Both tabs paused successfully');
      } else if (response) {
        logger.log('Failed to pause both tabs:', response.error);
      }
    } catch (err) {
      logger.error('Error pausing both tabs:', err);
    }
  }, true);

  logger.log('Keyboard shortcuts set up');
}
