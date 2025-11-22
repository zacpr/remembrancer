// Enhanced background script with improved message handling and statistics support

// Initialize background script
console.log('Form State Remembrancer - Enhanced Background Script Loaded');

let isPrivateBrowsing = false;

// Set up message listeners
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender, sendResponse);
  return true; // Keep the message channel open for async responses
});

// Enhanced message handling
async function handleMessage(message, sender, sendResponse) {
  try {
    switch (message.action) {
      case 'save':
        const saveResult = await handleSaveAction(sender);
        sendResponse(saveResult);
        break;

      case 'restore':
        const restoreResult = await handleRestoreAction(sender);
        sendResponse(restoreResult);
        break;

      case 'getStatistics':
        const stats = await getStatistics();
        sendResponse({ success: true, data: stats });
        break;

      case 'exportData':
        const exportData = await exportAllData();
        sendResponse({ success: true, data: exportData });
        break;

      case 'importData':
        await importData(message.data);
        sendResponse({ success: true });
        break;

      case 'clearAllData':
        await clearAllData();
        sendResponse({ success: true });
        break;

      case 'updateSettings':
        await updateSettings(message.settings);
        sendResponse({ success: true });
        break;

      case 'checkFormData':
        const checkResult = await checkFormData(message.url);
        sendResponse(checkResult);
        break;

      default:
        sendResponse({ success: false, error: 'Unknown action' });
    }
  } catch (error) {
    console.error('Error handling message:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Helper to get tab from sender or active tab
async function getTabFromSender(sender) {
  if (sender.tab) {
    return sender.tab;
  }
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

// Handle save action
async function handleSaveAction(sender) {
  console.log('Background: Handling save action');

  const tab = await getTabFromSender(sender);

  if (!tab) {
    console.error('Background: No tab information available');
    return { success: false, error: 'No tab information available' };
  }

  try {
    console.log('Background: Tab ID:', tab.id, 'URL:', tab.url);

    if (tab.url.startsWith('about:') || tab.url.startsWith('moz-extension:') || tab.url.startsWith('view-source:')) {
      return { success: false, error: 'Cannot save form data on this page type.' };
    }

    // Get form data from content script
    let response;
    try {
      response = await browser.tabs.sendMessage(tab.id, { action: 'getFormData' });
    } catch (e) {
      console.log('Background: Content script not ready, injecting...');
      await browser.tabs.executeScript(tab.id, { file: 'content.js' });
      // Wait a bit for script to initialize
      await new Promise(resolve => setTimeout(resolve, 100));
      response = await browser.tabs.sendMessage(tab.id, { action: 'getFormData' });
    }

    if (response && response.data) {
      const url = tab.url || sender.url;
      const saveData = {
        formData: response.data,
        metadata: {
          url: url,
          domain: new URL(url).hostname,
          title: tab.title,
          timestamp: Date.now(),
          formCount: response.data._metadata.totalInputs,
          userAgent: navigator.userAgent.substring(0, 100)
        }
      };

      await browser.storage.local.set({ [url]: saveData });
      await showNotification('Form Saved', 'Form state has been saved successfully', 'save');
      await updateBadge('saved', tab.id);

      console.log('Background: Save action completed successfully');
      return { success: true };
    } else {
      return { success: false, error: 'No form data received from content script' };
    }
  } catch (error) {
    console.error('Background: Error in save action:', error);
    return { success: false, error: error.message };
  }
}

// Handle restore action
async function handleRestoreAction(sender) {
  console.log('Background: Handling restore action', sender);

  const tab = await getTabFromSender(sender);
  console.log('Background: Identified tab:', tab);

  if (!tab) {
    console.error('Background: No tab information available');
    return { success: false, error: 'No tab information available' };
  }

  try {
    const url = tab.url || sender.url;
    console.log('Background: Tab ID:', tab.id, 'URL:', url);

    if (!url) {
      return { success: false, error: 'Could not determine page URL' };
    }

    if (url.startsWith('about:') || url.startsWith('moz-extension:') || url.startsWith('view-source:')) {
      return { success: false, error: 'Cannot restore form data on this page type.' };
    }

    const saveData = await findSavedData(url);

    if (saveData && saveData.formData) {
      let response;
      try {
        response = await browser.tabs.sendMessage(tab.id, {
          action: 'restoreFormData',
          data: saveData.formData
        });
      } catch (e) {
        await ensureContentScriptLoaded(tab.id);
        response = await browser.tabs.sendMessage(tab.id, {
          action: 'restoreFormData',
          data: saveData.formData
        });
      }

      if (response && response.success) {
        await showNotification('Form Restored', 'Form state has been restored successfully', 'restore');
        await updateBadge('restored', tab.id);
        console.log('Background: Restore action completed successfully');
        return { success: true };
      } else {
        return { success: false, error: 'Failed to restore form data in content script' };
      }
    } else {
      return { success: false, error: 'No saved form data found for this page' };
    }
  } catch (error) {
    console.error('Background: Error in restore action:', error);
    return { success: false, error: error.message };
  }
}

// Find saved data with fuzzy matching
async function findSavedData(currentUrl) {
  try {
    // 1. Try exact match
    const exactResult = await browser.storage.local.get(currentUrl);
    if (exactResult[currentUrl]) {
      return exactResult[currentUrl];
    }

    // 2. Fuzzy match: same origin and pathname
    const currentObj = new URL(currentUrl);
    const currentKey = currentObj.origin + currentObj.pathname;

    const allData = await browser.storage.local.get(null);
    let bestMatch = null;
    let latestTimestamp = 0;

    Object.keys(allData).forEach(key => {
      // Skip settings and stats
      if (key === 'settings' || key === 'statistics' || key === 'autoRestore') return;

      try {
        const savedObj = new URL(key);
        const savedKey = savedObj.origin + savedObj.pathname;

        if (savedKey === currentKey) {
          const data = allData[key];
          if (data.metadata && data.metadata.timestamp > latestTimestamp) {
            latestTimestamp = data.metadata.timestamp;
            bestMatch = data;
          }
        }
      } catch (e) {
        // Ignore invalid URLs in keys
      }
    });

    return bestMatch;
  } catch (error) {
    console.error('Error finding saved data:', error);
    return null;
  }
}

// Check if form data exists for URL (for popup)
async function checkFormData(url) {
  try {
    const data = await findSavedData(url);
    return {
      hasData: !!data,
      timestamp: data?.metadata?.timestamp
    };
  } catch (error) {
    return { hasData: false, error: error.message };
  }
}


// Helper to ensure content script is loaded
async function ensureContentScriptLoaded(tabId) {
  console.log('Background: Content script not ready, injecting...');
  await browser.tabs.executeScript(tabId, { file: 'content.js' });
  // Wait a bit for script to initialize
  await new Promise(resolve => setTimeout(resolve, 100));
}

// Get statistics
async function getStatistics() {
  try {
    const result = await browser.storage.local.get('statistics');
    return result.statistics || {
      totalSaved: 0,
      totalRestored: 0,
      uniqueDomains: [],
      domainStats: {},
      history: []
    };
  } catch (error) {
    console.error('Error getting statistics:', error);
    return null;
  }
}

// Export all data
async function exportAllData() {
  try {
    const allData = await browser.storage.local.get(null);

    // Remove sensitive or unnecessary data
    const exportData = {};
    Object.keys(allData).forEach(key => {
      if (key !== 'settings' && !key.startsWith('temp_')) {
        exportData[key] = allData[key];
      }
    });

    return exportData;
  } catch (error) {
    console.error('Error exporting data:', error);
    throw error;
  }
}

// Import data
async function importData(data) {
  try {
    // Validate data structure
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid data format');
    }

    // Clear existing data (except settings)
    const existingData = await browser.storage.local.get('settings');
    await browser.storage.local.clear();

    // Restore settings
    if (existingData.settings) {
      await browser.storage.local.set({ settings: existingData.settings });
    }

    // Import new data
    await browser.storage.local.set(data);

    console.log('Data imported successfully');
  } catch (error) {
    console.error('Error importing data:', error);
    throw error;
  }
}

// Clear all data
async function clearAllData() {
  try {
    // Keep settings
    const settings = await browser.storage.local.get('settings');
    await browser.storage.local.clear();

    if (settings.settings) {
      await browser.storage.local.set({ settings: settings.settings });
    }

    console.log('All data cleared successfully');
  } catch (error) {
    console.error('Error clearing data:', error);
    throw error;
  }
}

// Update settings
async function updateSettings(newSettings) {
  try {
    const existingSettings = await browser.storage.local.get('settings');
    const mergedSettings = {
      ...existingSettings.settings,
      ...newSettings
    };

    await browser.storage.local.set({ settings: mergedSettings });
    console.log('Settings updated successfully');
  } catch (error) {
    console.error('Error updating settings:', error);
    throw error;
  }
}

// Update badge
async function updateBadge(action, tabId) {
  try {
    const settings = await browser.storage.local.get('settings');
    const enableBadge = settings.settings?.enableBadge !== false;

    if (!enableBadge) return;

    switch (action) {
      case 'saved':
        browser.browserAction.setBadgeText({ text: '✓', tabId });
        browser.browserAction.setBadgeBackgroundColor({ color: '#4facfe', tabId });
        break;

      case 'restored':
        browser.browserAction.setBadgeText({ text: '↩', tabId });
        browser.browserAction.setBadgeBackgroundColor({ color: '#667eea', tabId });
        break;

      default:
        browser.browserAction.setBadgeText({ text: '', tabId });
    }

    // Clear badge after 3 seconds
    setTimeout(() => {
      browser.browserAction.setBadgeText({ text: '', tabId });
    }, 3000);
  } catch (error) {
    console.error('Error updating badge:', error);
  }
}

// Show notification
async function showNotification(title, message, type) {
  try {
    const settings = await browser.storage.local.get('settings');
    const enableNotifications = settings.settings?.enableNotifications !== false;

    if (!enableNotifications) return;

    const iconUrl = type === 'save' ?
      'icons/icon-48.png' :
      'icons/icon-96.png';

    browser.notifications.create({
      type: 'basic',
      iconUrl: iconUrl,
      title: title,
      message: message
    });
  } catch (error) {
    console.error('Error showing notification:', error);
  }
}

// Set up context menus
browser.runtime.onInstalled.addListener(() => {
  // Create context menu items
  browser.contextMenus.create({
    id: 'save-form',
    title: 'Save Form State',
    contexts: ['page', 'frame']
  });

  browser.contextMenus.create({
    id: 'restore-form',
    title: 'Restore Form State',
    contexts: ['page', 'frame']
  });

  browser.contextMenus.create({
    id: 'separator',
    type: 'separator',
    contexts: ['page', 'frame']
  });

  browser.contextMenus.create({
    id: 'open-popup',
    title: 'Open Form Remembrancer',
    contexts: ['page', 'frame']
  });
});

// Handle context menu clicks
browser.contextMenus.onClicked.addListener(async (info, tab) => {
  try {
    switch (info.menuItemId) {
      case 'save-form':
        await handleSaveAction({ tab });
        break;

      case 'restore-form':
        await handleRestoreAction({ tab });
        break;

      case 'open-popup':
        browser.browserAction.openPopup();
        break;
    }
  } catch (error) {
    console.error('Error handling context menu click:', error);
  }
});

// Set up keyboard shortcuts
browser.commands.onCommand.addListener(async (command) => {
  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tabs[0]) return;

    const sender = { tab: tabs[0] };

    switch (command) {
      case 'save-form':
        await handleSaveAction(sender);
        break;

      case 'restore-form':
        await handleRestoreAction(sender);
        break;

      case 'toggle-auto-restore':
        // Toggle auto-restore for current page
        const url = tabs[0].url;
        const result = await browser.storage.local.get('autoRestore');
        const autoRestore = result.autoRestore || {};
        autoRestore[url] = !autoRestore[url];
        await browser.storage.local.set({ autoRestore });

        const status = autoRestore[url] ? 'enabled' : 'disabled';
        await showNotification('Auto-Restore', `Auto-restore ${status} for this page`, 'toggle');
        break;
    }
  } catch (error) {
    console.error('Error handling keyboard shortcut:', error);
  }
});

// Set up tab updates to track form availability
browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    try {
      // Check if page has forms and update badge accordingly
      const hasForms = await checkPageForForms(tabId);

      if (hasForms) {
        browser.browserAction.setBadgeText({ text: '📝', tabId });
        browser.browserAction.setBadgeBackgroundColor({ color: '#667eea', tabId });
      } else {
        browser.browserAction.setBadgeText({ text: '', tabId });
      }
    } catch (error) {
      console.error('Error checking page for forms:', error);
    }
  }
});

// Check if page has forms
async function checkPageForForms(tabId) {
  try {
    const response = await browser.tabs.sendMessage(tabId, { action: 'countForms' });
    return response && response.count > 0;
  } catch (error) {
    // Content script might not be loaded yet
    return false;
  }
}

// Set up storage change listener
browser.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local') {
    // Update badge if auto-restore settings change
    if (changes.autoRestore) {
      console.log('Auto-restore settings changed');
    }

    // Update statistics if they change
    if (changes.statistics) {
      console.log('Statistics updated');
    }
  }
});

// Initialize extension on startup
browser.runtime.onStartup.addListener(async () => {
  console.log('Form State Remembrancer - Extension started');

  // Set default settings if not exists
  const settings = await browser.storage.local.get('settings');
  if (!settings.settings) {
    const defaultSettings = {
      enableNotifications: true,
      enableSounds: false,
      enableBadge: true,
      autoRestore: {}
    };
    await browser.storage.local.set({ settings: defaultSettings });
  }
});

// Handle extension installation/update
browser.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    console.log('Form State Remembrancer - Extension installed');

    // Set default settings
    const defaultSettings = {
      enableNotifications: true,
      enableSounds: false,
      enableBadge: true,
      autoRestore: {}
    };
    await browser.storage.local.set({ settings: defaultSettings });

    // Show welcome notification
    await showNotification(
      'Form Remembrancer Installed!',
      'Right-click on any page to save form states, or use the popup.',
      'save'
    );

  } else if (details.reason === 'update') {
    console.log('Form State Remembrancer - Extension updated');

    // Show update notification
    await showNotification(
      'Form Remembrancer Updated!',
      'Check out the new features and improvements.',
      'restore'
    );
  }
});

// Cleanup on extension unload
window.addEventListener('beforeunload', () => {
  console.log('Form State Remembrancer - Extension shutting down');
});