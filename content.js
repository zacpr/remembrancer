browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'save') {
    console.log('Saving form state');
    const inputs = document.querySelectorAll('input, textarea, select');
    const data = {};
    inputs.forEach((input, index) => {
      const key = `${input.tagName}_${input.type}_${input.name}_${index}`;
      if (input.type === 'checkbox' || input.type === 'radio') {
        data[key] = input.checked;
      } else {
        data[key] = input.value;
      }
    });
    browser.storage.local.set({ [window.location.href]: data });
  } else if (message.action === 'restore') {
    restoreForm();
  }
});

function restoreForm() {
  console.log('Restoring form state');
  browser.storage.local.get(window.location.href).then(result => {
    const data = result[window.location.href];
    if (data) {
      const inputs = document.querySelectorAll('input, textarea, select');
      inputs.forEach((input, index) => {
        const key = `${input.tagName}_${input.type}_${input.name}_${index}`;
        if (data[key] !== undefined) {
          if (input.type === 'checkbox' || input.type === 'radio') {
            input.checked = data[key];
          } else {
            input.value = data[key];
          }
        }
      });
    }
  });
}

browser.storage.local.get('autoRestore').then(result => {
  const autoRestore = result.autoRestore || {};
  if (autoRestore[window.location.href]) {
    restoreForm();
  }
});
