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
        await handleSaveAction(sender);
        sendResponse({ success: true });
        break;
        
      case 'restore':
        await handleRestoreAction(sender);
        sendResponse({ success: true });
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
        
      default:
        sendResponse({ success: false, error: 'Unknown action' });
    }
  } catch (error) {
    console.error('Error handling message:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Handle save action
async function handleSaveAction(sender) {
  console.log('Background: Handling save action');
  
  if (!sender.tab) {
    console.error('Background: No tab information available');
    return { success: false, error: 'No tab information available' };
  }
  
  try {
    console.log('Background: Tab ID:', sender.tab.id, 'URL:', sender.tab.url);
    
    // Check if private browsing
    if (sender.tab.incognito) {
      console.log('Background: Private browsing mode detected');
      await showNotification('🔒 Private Mode', 'Form saved in private browsing mode', 'warning');
    }
    
    // Send save message to content script and wait for response
    console.log('Background: Sending save message to content script');
    const response = await browser.tabs.sendMessage(sender.tab.id, { action: 'save' });
    console.log('Background: Received response from content script:', response);
    
    if (response && response.success) {
      // Update badge to indicate save
      await updateBadge('saved', sender.tab.id);
      
      // Show notification if enabled
      await showNotification('Form Saved', 'Form state has been saved successfully', 'save');
      
      console.log('Background: Save action completed successfully');
      return { success: true };
    } else {
      const errorMsg = response?.error || 'Save operation failed in content script';
      console.error('Background: Save action failed:', errorMsg);
      return { success: false, error: errorMsg };
    }
  } catch (error) {
    console.error('Background: Error in save action:', error);
    return { success: false, error: error.message };
  }
}

// Handle restore action
async function handleRestoreAction(sender) {
  console.log('Background: Handling restore action');
  
  if (!sender.tab) {
    console.error('Background: No tab information available');
    return { success: false, error: 'No tab information available' };
  }
  
  try {
    console.log('Background: Tab ID:', sender.tab.id, 'URL:', sender.tab.url);
    
    // Check if private browsing
    if (sender.tab.incognito) {
      console.log('Background: Private browsing mode detected');
      await showNotification('🔒 Private Mode', 'Form restored in private browsing mode', 'warning');
    }
    
    // Send restore message to content script and wait for response
    console.log('Background: Sending restore message to content script');
    const response = await browser.tabs.sendMessage(sender.tab.id, { action: 'restore' });
    console.log('Background: Received response from content script:', response);
    
    if (response && response.success) {
      // Update badge to indicate restore
      await updateBadge('restored', sender.tab.id);
      
      // Show notification if enabled
      await showNotification('Form Restored', 'Form state has been restored successfully', 'restore');
      
      console.log('Background: Restore action completed successfully');
      return { success: true };
    } else {
      const errorMsg = response?.error || 'Restore operation failed in content script';
      console.error('Background: Restore action failed:', errorMsg);
      return { success: false, error: errorMsg };
    }
  } catch (error) {
    console.error('Background: Error in restore action:', error);
    return { success: false, error: error.message };
  }
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