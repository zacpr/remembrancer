// Global state management
let currentTab = 'actions';
let forgetButtonState = 'normal';

let isPrivateBrowsing = false;
let currentTheme = 'gradient';
let highContrast = false;
let dimInactive = false;

// Initialize the popup
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Popup initialized');
  initializeTabs();
  initializeActionButtons();
  initializeSettings();
  await updateCurrentPageInfo();
  updateButtonStates();
  initializeKeyboardShortcuts();
});

// Tab navigation system
function initializeTabs() {
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');

  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const targetTab = button.dataset.tab;

      // Update active states
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabPanes.forEach(pane => pane.classList.remove('active'));

      button.classList.add('active');
      document.getElementById(`${targetTab}-tab`).classList.add('active');

      currentTab = targetTab;
    });
  });
}

// Initialize action buttons with enhanced functionality
function initializeActionButtons() {
  // Save button - sends message to background script
  document.getElementById('save-button').addEventListener('click', async () => {
    console.log('Save button clicked - sending message to background script');
    showLoading(true);

    try {
      const response = await browser.runtime.sendMessage({ action: 'save' });
      console.log('Response from background script:', response);

      if (response && response.success) {
        showToast('Form state saved successfully!', 'success');
        setTimeout(updateButtonStates, 100);
      } else {
        showToast(`Save failed: ${response?.error || 'Unknown error'}`, 'error');
      }

    } catch (error) {
      console.error('Save error:', error);
      showToast(`Save failed: ${error.message}`, 'error');
    } finally {
      showLoading(false);
    }
  });

  // Restore button - sends message to background script
  document.getElementById('restore-button').addEventListener('click', async () => {
    console.log('Restore button clicked - sending message to background script');
    showLoading(true);

    try {
      const response = await browser.runtime.sendMessage({ action: 'restore' });
      console.log('Response from background script:', response);

      if (response && response.success) {
        showToast('Form state restored successfully!', 'success');
      } else {
        showToast(`Restore failed: ${response?.error || 'Unknown error'}`, 'error');
      }

    } catch (error) {
      console.error('Restore error:', error);
      showToast(`Restore failed: ${error.message}`, 'error');
    } finally {
      showLoading(false);
    }
  });

  // Auto-restore toggle button
  document.getElementById('auto-restore-button').addEventListener('click', async () => {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    const url = tabs[0].url;

    try {
      const result = await browser.storage.local.get('autoRestore');
      const autoRestore = result.autoRestore || {};

      // Prevent auto-restore in private browsing
      if (isPrivateBrowsing) {
        showToast('🔒 Auto-restore is disabled in private browsing mode', 'warning');
        return;
      }

      autoRestore[url] = !autoRestore[url];

      await browser.storage.local.set({ autoRestore });

      const button = document.getElementById('auto-restore-button');
      const isEnabled = autoRestore[url];

      button.querySelector('.btn-text').textContent = isEnabled ? 'Disable Auto-Restore' : 'Enable Auto-Restore';

      showToast(`Auto-restore ${isEnabled ? 'enabled' : 'disabled'}`, 'success');
      updateButtonStates();
    } catch (error) {
      showToast('Failed to toggle auto-restore', 'error');
    }
  });

  // Forget button with confirmation
  document.getElementById('forget-button').addEventListener('click', async () => {
    const button = document.getElementById('forget-button');

    if (forgetButtonState === 'normal') {
      // First click - enter confirmation mode
      forgetButtonState = 'confirm';
      button.querySelector('.btn-text').textContent = 'FORGET, YOU SURE?';
      button.classList.add('forget-confirming');
      button.style.fontWeight = '700';
      button.style.textTransform = 'uppercase';

      // Auto-reset after 3 seconds if no second click
      setTimeout(() => {
        if (forgetButtonState === 'confirm') {
          forgetButtonState = 'normal';
          button.querySelector('.btn-text').textContent = 'Forget Data';
          button.classList.remove('forget-confirming');
          button.style.fontWeight = '500';
          button.style.textTransform = 'none';
        }
      }, 3000);

    } else if (forgetButtonState === 'confirm') {
      // Second click - actually forget the data
      showLoading(true);
      try {
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        const url = tabs[0].url;

        await browser.storage.local.remove(url);

        const result = await browser.storage.local.get('autoRestore');
        const autoRestore = result.autoRestore || {};
        delete autoRestore[url];
        await browser.storage.local.set({ autoRestore });

        showToast('Form data forgotten successfully', 'success');
        forgetButtonState = 'normal';
        button.querySelector('.btn-text').textContent = 'Forget Data';
        button.classList.remove('forget-confirming');
        button.style.fontWeight = '500';
        button.style.textTransform = 'none';

        updateButtonStates();
      } catch (error) {
        showToast('Failed to forget form data', 'error');
        // Reset button state on error
        forgetButtonState = 'normal';
        button.querySelector('.btn-text').textContent = 'Forget Data';
        button.classList.remove('forget-confirming');
        button.style.fontWeight = '500';
        button.style.textTransform = 'none';
      } finally {
        showLoading(false);
      }
    }
  });
}

// Update button states based on form data availability
async function updateButtonStates() {
  try {
    console.log('Updating button states...');
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tabs[0]) {
      console.log('No active tab found');
      return;
    }

    const url = tabs[0].url;
    console.log('Current URL:', url);

    // Check for form data using background script (supports fuzzy matching)
    const checkResult = await browser.runtime.sendMessage({
      action: 'checkFormData',
      url: url
    });

    const hasFormData = checkResult && checkResult.hasData;
    console.log('Has form data:', hasFormData);

    const restoreButton = document.getElementById('restore-button');
    const autoRestoreButton = document.getElementById('auto-restore-button');
    const forgetButton = document.getElementById('forget-button');
    const saveButton = document.getElementById('save-button');

    if (!restoreButton || !autoRestoreButton || !forgetButton || !saveButton) {
      console.error('Button elements not found');
      return;
    }

    // Remove previous state classes
    restoreButton.classList.remove('no-form-data', 'has-form-data');
    autoRestoreButton.classList.remove('no-form-data', 'has-form-data');
    forgetButton.classList.remove('no-form-data', 'has-form-data');
    saveButton.classList.remove('no-form-data', 'has-form-data');

    // Button state logic based on form data
    if (hasFormData) {
      console.log('Enabling restore/forget buttons, disabling save button');
      // When form data exists:
      // - Remember button should be greyed out and unclickable
      saveButton.disabled = true;
      saveButton.classList.add('has-form-data');

      // - Restore, auto-restore, and forget should be enabled
      restoreButton.disabled = false;
      autoRestoreButton.disabled = false;
      forgetButton.disabled = false;

      restoreButton.classList.remove('no-form-data');
      autoRestoreButton.classList.remove('no-form-data');
      forgetButton.classList.remove('no-form-data');

    } else {
      console.log('Enabling save button, disabling restore/forget buttons');
      // When no form data exists:
      // - Restore, auto-restore, and forget should be greyed out and unclickable
      restoreButton.disabled = true;
      autoRestoreButton.disabled = true;
      forgetButton.disabled = true;

      restoreButton.classList.add('no-form-data');
      autoRestoreButton.classList.add('no-form-data');
      forgetButton.classList.add('no-form-data');

      // - Remember button should be enabled
      saveButton.disabled = false;
      saveButton.classList.remove('has-form-data');
    }

    // Update auto-restore button text
    const autoRestoreResult = await browser.storage.local.get('autoRestore');
    const autoRestore = autoRestoreResult.autoRestore || {};
    const isAutoRestoreEnabled = autoRestore[url] === true;

    const btnText = autoRestoreButton.querySelector('.btn-text');
    if (btnText) {
      btnText.textContent = isAutoRestoreEnabled ? 'Disable Auto-Restore' : 'Enable Auto-Restore';
    }

    // Reset forget button state if not in confirmation mode
    if (forgetButtonState === 'confirm') {
      // Don't reset if in confirmation mode
    } else {
      forgetButtonState = 'normal';
      const forgetBtnText = forgetButton.querySelector('.btn-text');
      if (forgetBtnText) {
        forgetBtnText.textContent = 'Forget Data';
      }
      forgetButton.classList.remove('forget-confirming');
      forgetButton.style.fontWeight = '500';
      forgetButton.style.textTransform = 'none';
    }

    // Update page info
    try {
      const formCount = await detectFormCount();
      document.getElementById('current-url').textContent = new URL(url).hostname;
      document.getElementById('form-count').textContent = `${formCount} forms found`;
      console.log(`Detected ${formCount} forms on page`);
    } catch (e) {
      document.getElementById('current-url').textContent = new URL(url).hostname;
      document.getElementById('form-count').textContent = 'Unable to detect forms';
      console.error('Error detecting forms:', e);
    }

    // Update stats badge
    try {
      const totalForms = await getTotalFormCount();
      document.getElementById('total-forms').textContent = `${totalForms} forms`;
    } catch (e) {
      document.getElementById('total-forms').textContent = '0 forms';
      console.error('Error getting total form count:', e);
    }

    console.log('Button states updated successfully');
  } catch (error) {
    console.error('Error updating button states:', error);
  }
}

// Update current page information
async function updateCurrentPageInfo() {
  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tabs[0]) {
      document.getElementById('current-url').textContent = 'No page detected';
      document.getElementById('form-count').textContent = '0 forms found';
      return;
    }

    const url = tabs[0].url;
    const domain = new URL(url).hostname;

    document.getElementById('current-url').textContent = domain;

    // Count forms on current page
    try {
      const forms = await browser.tabs.sendMessage(tabs[0].id, { action: 'countForms' });
      document.getElementById('form-count').textContent = `${forms || 0} form${forms !== 1 ? 's' : ''} found`;
    } catch (e) {
      document.getElementById('form-count').textContent = 'Unable to detect forms';
    }
  } catch (error) {
    document.getElementById('current-url').textContent = 'No page detected';
    document.getElementById('form-count').textContent = '0 forms found';
  }
}

// Detect form count on current page
async function detectFormCount() {
  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tabs[0]) return 0;

    const response = await browser.tabs.sendMessage(tabs[0].id, { action: 'countForms' });
    return response ? response.count || 0 : 0;
  } catch (error) {
    console.error('Error detecting form count:', error);
    return 0;
  }
}

// Get total form count from statistics (still used for badge)
async function getTotalFormCount() {
  try {
    const result = await browser.storage.local.get('statistics');
    const stats = result.statistics || {};
    return stats.totalSaved || 0;
  } catch (error) {
    console.error('Error getting total form count:', error);
    return 0;
  }
}

// Settings management
function initializeSettings() {
  // Load settings
  browser.storage.local.get('settings').then(result => {
    const settings = result.settings || {
      enableNotifications: true,
      enableSounds: false,
      theme: 'gradient',
      highContrast: false,
      dimInactive: true
    };

    document.getElementById('enable-notifications').checked = settings.enableNotifications;
    document.getElementById('enable-sounds').checked = settings.enableSounds;
    document.getElementById('remove-colors').checked = settings.highContrast;
    document.getElementById('dim-inactive').checked = settings.dimInactive;

    // Set theme
    const theme = settings.theme || 'gradient';
    const themeRadio = document.querySelector(`input[name="theme"][value="${theme}"]`);
    if (themeRadio) {
      themeRadio.checked = true;
    }
    applyTheme(theme);

    // Apply other appearance settings
    if (settings.highContrast) {
      document.documentElement.setAttribute('data-high-contrast', 'true');
    }

    // Apply dim inactive setting (handled in CSS/JS logic usually, but good to store)
    dimInactive = settings.dimInactive;
  });

  // Save settings on change
  document.getElementById('enable-notifications').addEventListener('change', saveSettings);
  document.getElementById('enable-sounds').addEventListener('change', saveSettings);
  document.getElementById('remove-colors').addEventListener('change', saveSettings);
  document.getElementById('dim-inactive').addEventListener('change', saveSettings);

  // Theme radio buttons
  const themeRadios = document.querySelectorAll('input[name="theme"]');
  themeRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (e.target.checked) {
        applyTheme(e.target.value);
        saveSettings();
      }
    });
  });

  // Clear all data button
  document.getElementById('clear-all-data').addEventListener('click', async () => {
    if (confirm('Are you sure you want to clear all data? This cannot be undone.')) {
      try {
        await browser.storage.local.clear();
        // Reset stats locally
        statistics = {
          totalSaved: 0,
          totalRestored: 0,
          uniqueDomains: new Set(),
          domainStats: {},
          history: []
        };
        showToast('All data cleared successfully', 'success');
        updateButtonStates();
      } catch (error) {
        showToast('Failed to clear data', 'error');
      }
    }
  });
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  currentTheme = theme;
}

async function saveSettings() {
  const selectedTheme = document.querySelector('input[name="theme"]:checked')?.value || 'gradient';

  const settings = {
    enableNotifications: document.getElementById('enable-notifications').checked,
    enableSounds: document.getElementById('enable-sounds').checked,
    theme: selectedTheme,
    highContrast: document.getElementById('remove-colors').checked,
    dimInactive: document.getElementById('dim-inactive').checked
  };

  // Apply high contrast immediately
  if (settings.highContrast) {
    document.documentElement.setAttribute('data-high-contrast', 'true');
  } else {
    document.documentElement.removeAttribute('data-high-contrast');
  }

  dimInactive = settings.dimInactive;

  await browser.storage.local.set({ settings });
}

// Toast notification system
function showToast(message, type = 'success') {
  browser.storage.local.get('settings').then(result => {
    const settings = result.settings || { enableNotifications: true };

    if (!settings.enableNotifications) return;

    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => {
        container.removeChild(toast);
      }, 300);
    }, 3000);
  });
}

// Loading overlay
function showLoading(show) {
  const overlay = document.getElementById('loading-overlay');
  if (show) {
    overlay.classList.add('active');
  } else {
    overlay.classList.remove('active');
  }
}

// Keyboard shortcuts
function initializeKeyboardShortcuts() {
  document.addEventListener('keydown', (event) => {
    if (event.ctrlKey || event.metaKey) {
      switch (event.key) {
        case 's':
          event.preventDefault();
          document.getElementById('save-button').click();
          break;
        case 'r':
          event.preventDefault();
          document.getElementById('restore-button').click();
          break;
        case 'd':
          event.preventDefault();
          document.getElementById('forget-button').click();
          break;
      }
    }
  });
}

// Add slide out animation
const style = document.createElement('style');
style.textContent = `
  @keyframes slideOut {
    to {
      transform: translateX(100%);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);