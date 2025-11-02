// Variable to track forget button state
let forgetButtonState = 'normal'; // 'normal' or 'confirm'

// Function to update button states based on stored form data
function updateButtonStates() {
  browser.tabs.query({ active: true, currentWindow: true }).then(tabs => {
    const url = tabs[0].url;
    
    // Check if there's a remembered form for this URL
    browser.storage.local.get(url).then(result => {
      const hasFormData = result[url] !== undefined;
      const restoreButton = document.getElementById('restore-button');
      const autoRestoreButton = document.getElementById('auto-restore-button');
      const forgetButton = document.getElementById('forget-button');
      
      // Enable/disable restore button based on whether form data exists
      restoreButton.disabled = !hasFormData;
      
      // Auto-restore button should only be enabled if there's form data
      autoRestoreButton.disabled = !hasFormData;
      
      // Forget button should only be enabled if there's form data
      forgetButton.disabled = !hasFormData;
      
      // Reset forget button state when updating
      forgetButtonState = 'normal';
      forgetButton.textContent = 'Forget';
      
      // Update auto-restore button text to show current state
      browser.storage.local.get('autoRestore').then(autoRestoreResult => {
        const autoRestore = autoRestoreResult.autoRestore || {};
        const isAutoRestoreEnabled = autoRestore[url] === true;
        autoRestoreButton.textContent = isAutoRestoreEnabled ?
          'Disable Auto-Restore' : 'Enable Auto-Restore';
      });
    });
  });
}

// Update button states when popup is opened
document.addEventListener('DOMContentLoaded', updateButtonStates);

document.getElementById('save-button').addEventListener('click', () => {
  browser.runtime.sendMessage({ action: 'save' });
  // Update button states after saving
  setTimeout(updateButtonStates, 100);
});

document.getElementById('restore-button').addEventListener('click', () => {
  browser.runtime.sendMessage({ action: 'restore' });
});

document.getElementById('auto-restore-button').addEventListener('click', () => {
  browser.tabs.query({ active: true, currentWindow: true }).then(tabs => {
    const url = tabs[0].url;
    browser.storage.local.get('autoRestore').then(result => {
      const autoRestore = result.autoRestore || {};
      autoRestore[url] = !autoRestore[url];
      browser.storage.local.set({ autoRestore });
      // Update button text to reflect new state
      updateButtonStates();
    });
  });
});

document.getElementById('forget-button').addEventListener('click', () => {
  const forgetButton = document.getElementById('forget-button');
  
  if (forgetButtonState === 'normal') {
    // First click - show confirmation
    forgetButtonState = 'confirm';
    forgetButton.textContent = 'Forget, you sure?';
  } else if (forgetButtonState === 'confirm') {
    // Second click - actually forget the data
    browser.tabs.query({ active: true, currentWindow: true }).then(tabs => {
      const url = tabs[0].url;
      
      // Remove form data for this URL
      browser.storage.local.remove(url);
      
      // Also remove auto-restore setting for this URL
      browser.storage.local.get('autoRestore').then(result => {
        const autoRestore = result.autoRestore || {};
        delete autoRestore[url];
        browser.storage.local.set({ autoRestore });
      });
      
      // Update button states after removing data
      updateButtonStates();
    });
  }
});
