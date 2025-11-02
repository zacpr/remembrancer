browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'save') {
    browser.tabs.query({ active: true, currentWindow: true }).then(tabs => {
      browser.tabs.sendMessage(tabs[0].id, { action: 'save' });
    });
  } else if (message.action === 'restore') {
    browser.tabs.query({ active: true, currentWindow: true }).then(tabs => {
      browser.tabs.sendMessage(tabs[0].id, { action: 'restore' });
    });
  }
});
