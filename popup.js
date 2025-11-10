// Global state management
let currentTab = 'actions';
let forgetButtonState = 'normal';
let statistics = {
  totalSaved: 0,
  totalRestored: 0,
  uniqueDomains: new Set(),
  domainStats: {},
  history: []
};

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
  await loadStatistics();
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
      
      // Load tab-specific content
      if (targetTab === 'statistics') {
        loadStatisticsTab();
      } else if (targetTab === 'history') {
        loadHistoryTab();
      }
    });
  });
}

// Initialize action buttons with enhanced functionality
function initializeActionButtons() {
  // Handshake function to check for content script readiness
  async function handshake(tabId) {
    try {
      const response = await browser.tabs.sendMessage(tabId, { action: 'ping' });
      return response && response.action === 'pong';
    } catch (error) {
      console.error('Handshake failed:', error);
      return false;
    }
  }

  // Save button - simplified direct approach with better error handling
  document.getElementById('save-button').addEventListener('click', async () => {
    console.log('Save button clicked - using simplified approach');
    showLoading(true);
    
    try {
      // Get current tab directly
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      if (!tabs[0]) {
        showToast('No active tab found', 'error');
        showLoading(false);
        return;
      }
      
      const currentTab = tabs[0];
      console.log('Current tab:', currentTab.url);
      
      // Check if we can communicate with content script
      if (!await handshake(currentTab.id)) {
        showToast('Content script not ready. Please refresh the page and try again.', 'error');
        showLoading(false);
        return;
      }
      
      try {
        // Get form data directly from content script
        const response = await browser.tabs.sendMessage(currentTab.id, { action: 'save' });
        console.log('Form data received:', response);
        
        if (!response || !response.success) {
          showToast('No form data to save', 'error');
          showLoading(false);
          return;
        }
        
        console.log('Save verified successfully');
        await recordStatistics('save');
        showToast('Form state saved successfully!', 'success');
        setTimeout(updateButtonStates, 100);
        
      } catch (messageError) {
        console.error('Error communicating with content script:', messageError);
        if (messageError.message.includes('Receiving end does not exist')) {
          showToast('Content script not loaded. Please refresh the page and try again.', 'error');
        } else if (messageError.message.includes('Could not establish connection')) {
          showToast('Cannot connect to content script. Please refresh the page.', 'error');
        } else {
          showToast(`Communication error: ${messageError.message}`, 'error');
        }
      }
      
    } catch (error) {
      console.error('Save error:', error);
      showToast(`Save failed: ${error.message}`, 'error');
    } finally {
      showLoading(false);
    }
  });

  // Restore button - simplified direct approach with better error handling
  document.getElementById('restore-button').addEventListener('click', async () => {
    console.log('Restore button clicked - using simplified approach');
    showLoading(true);
    
    try {
      // Get current tab directly
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      if (!tabs[0]) {
        showToast('No active tab found', 'error');
        showLoading(false);
        return;
      }
      
      const currentTab = tabs[0];
      console.log('Current tab for restore:', currentTab.url);
      
      // Check if we can communicate with content script
      if (!await handshake(currentTab.id)) {
        showToast('Content script not ready. Please refresh the page and try again.', 'error');
        showLoading(false);
        return;
      }
      
      try {
        
        // Send restore data to content script
        const restoreResponse = await browser.tabs.sendMessage(currentTab.id, {
          action: 'restore'
        });
        console.log('Restore response from content:', restoreResponse);
        
        if (restoreResponse && restoreResponse.success) {
          console.log('Restore successful');
          await recordStatistics('restore');
          showToast('Form state restored successfully!', 'success');
        } else {
          showToast('Failed to restore form data', 'error');
        }
        
      } catch (messageError) {
        console.error('Error communicating with content script:', messageError);
        if (messageError.message.includes('Receiving end does not exist')) {
          showToast('Content script not loaded. Please refresh the page and try again.', 'error');
        } else if (messageError.message.includes('Could not establish connection')) {
          showToast('Cannot connect to content script. Please refresh the page.', 'error');
        } else {
          showToast(`Communication error: ${messageError.message}`, 'error');
        }
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
        await loadStatistics();
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
    
    const result = await browser.storage.local.get(url);
    const hasFormData = result[url] !== undefined && result[url] !== null;
    console.log('Has form data:', hasFormData);
    console.log('Stored data for URL:', result[url]);
    
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

// Get total form count from statistics
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

// Statistics management
async function loadStatistics() {
  try {
    const result = await browser.storage.local.get(['statistics', 'history']);
    statistics = result.statistics || {
      totalSaved: 0,
      totalRestored: 0,
      uniqueDomains: new Set(),
      domainStats: {},
      history: []
    };
    
    // Convert Set back from array if needed
    if (Array.isArray(statistics.uniqueDomains)) {
      statistics.uniqueDomains = new Set(statistics.uniqueDomains);
    }
    
    updateStatisticsDisplay();
  } catch (error) {
    console.error('Error loading statistics:', error);
  }
}

async function recordStatistics(action) {
  try {
    console.log('Recording statistics for action:', action);
    
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tabs[0]) {
      console.error('No active tab found for statistics');
      return;
    }
    
    const url = tabs[0].url;
    const domain = new URL(url).hostname;
    
    console.log('Current statistics before update:', statistics);
    
    if (action === 'save') {
      statistics.totalSaved++;
      console.log('Incremented totalSaved to:', statistics.totalSaved);
    } else if (action === 'restore') {
      statistics.totalRestored++;
      console.log('Incremented totalRestored to:', statistics.totalRestored);
    }
    
    statistics.uniqueDomains.add(domain);
    
    if (!statistics.domainStats[domain]) {
      statistics.domainStats[domain] = { saves: 0, restores: 0 };
    }
    
    if (action === 'save') {
      statistics.domainStats[domain].saves++;
    } else if (action === 'restore') {
      statistics.domainStats[domain].restores++;
    }
    
    // Add to history
    statistics.history.unshift({
      url: url,
      domain: domain,
      action: action,
      timestamp: Date.now()
    });
    
    // Keep only last 50 history items
    if (statistics.history.length > 50) {
      statistics.history = statistics.history.slice(0, 50);
    }
    
    console.log('Saving statistics to storage:', {
      ...statistics,
      uniqueDomains: Array.from(statistics.uniqueDomains)
    });
    
    await browser.storage.local.set({
      statistics: {
        ...statistics,
        uniqueDomains: Array.from(statistics.uniqueDomains)
      }
    });
    
    updateStatisticsDisplay();
    console.log('Statistics recorded successfully');
  } catch (error) {
    console.error('Error recording statistics:', error);
  }
}

function updateStatisticsDisplay() {
  console.log('Updating statistics display with data:', statistics);
  
  const totalFormsElement = document.getElementById('total-forms');
  const totalSavedElement = document.getElementById('total-saved');
  const totalRestoredElement = document.getElementById('total-restored');
  const uniqueDomainsElement = document.getElementById('unique-domains');
  
  if (totalFormsElement) {
    totalFormsElement.textContent = `${statistics.totalSaved} forms`;
  }
  if (totalSavedElement) {
    totalSavedElement.textContent = statistics.totalSaved;
  }
  if (totalRestoredElement) {
    totalRestoredElement.textContent = statistics.totalRestored;
  }
  if (uniqueDomainsElement) {
    uniqueDomainsElement.textContent = statistics.uniqueDomains.size;
  }
  
  console.log('Statistics display updated:', {
    totalSaved: statistics.totalSaved,
    totalRestored: statistics.totalRestored,
    uniqueDomains: statistics.uniqueDomains.size
  });
}

function loadStatisticsTab() {
  // Check if statistics are enabled
  browser.storage.local.get('settings').then(result => {
    const settings = result.settings || {};
    if (!settings.enableStatistics) {
      document.getElementById('statistics-tab').innerHTML = `
        <div style="text-align: center; padding: 40px 20px; color: var(--text-secondary);">
          <div style="font-size: 48px; margin-bottom: 16px;">📊</div>
          <div>Statistics are disabled</div>
          <div style="font-size: 12px; margin-top: 8px;">Enable statistics in settings to see usage data</div>
        </div>
      `;
      return;
    }
    
    // Update domain statistics
    const domainList = document.getElementById('domain-list');
    domainList.innerHTML = '';
    
    const sortedDomains = Object.entries(statistics.domainStats)
      .sort(([,a], [,b]) => (b.saves + b.restores) - (a.saves + a.restores))
      .slice(0, 5);
    
    sortedDomains.forEach(([domain, stats]) => {
      const item = document.createElement('div');
      item.className = 'domain-item';
      
      const domainSpan = document.createElement('span');
      domainSpan.className = 'domain-name';
      domainSpan.textContent = domain;
      
      const countSpan = document.createElement('span');
      countSpan.className = 'domain-count';
      countSpan.textContent = String(stats.saves + stats.restores);
      
      item.appendChild(domainSpan);
      item.appendChild(countSpan);
      domainList.appendChild(item);
    });
    
    // Draw usage chart
    drawUsageChart();
  });
}

function drawUsageChart() {
  const canvas = document.getElementById('usage-chart');
  const ctx = canvas.getContext('2d');
  
  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Get last 7 days of data
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const days = [];
  
  for (let i = 6; i >= 0; i--) {
    const dayStart = now - (i * dayMs);
    const dayEnd = dayStart + dayMs;
    
    const dayActions = statistics.history.filter(item => 
      item.timestamp >= dayStart && item.timestamp < dayEnd
    ).length;
    
    days.push({
      date: new Date(dayStart).toLocaleDateString('en', { weekday: 'short' }),
      count: dayActions
    });
  }
  
  // Draw simple bar chart
  const maxCount = Math.max(...days.map(d => d.count), 1);
  const barWidth = canvas.width / days.length - 10;
  const chartHeight = canvas.height - 20;
  
  days.forEach((day, index) => {
    const barHeight = (day.count / maxCount) * chartHeight;
    const x = index * (barWidth + 10) + 5;
    const y = canvas.height - barHeight - 10;
    
    // Draw bar with gradient
    const gradient = ctx.createLinearGradient(0, y, 0, canvas.height - 10);
    gradient.addColorStop(0, '#667eea');
    gradient.addColorStop(1, '#764ba2');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, barWidth, barHeight);
    
    // Draw label
    ctx.fillStyle = '#a8a8b3';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(day.date, x + barWidth / 2, canvas.height - 2);
  });
}

function loadHistoryTab() {
  const historyList = document.getElementById('history-list');
  historyList.innerHTML = '';
  
  const recentHistory = statistics.history.slice(0, 20);
  
  recentHistory.forEach(item => {
    const historyItem = document.createElement('div');
    historyItem.className = 'history-item';
    
    const historyInfo = document.createElement('div');
    historyInfo.className = 'history-info';
    
    const historyUrl = document.createElement('div');
    historyUrl.className = 'history-url';
    historyUrl.textContent = item.domain;
    
    const date = new Date(item.timestamp);
    const timeString = date.toLocaleString('en', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    const historyTime = document.createElement('div');
    historyTime.className = 'history-time';
    historyTime.textContent = `${timeString} - ${item.action}`;
    
    const historyActions = document.createElement('div');
    historyActions.className = 'history-actions';
    
    const deleteButton = document.createElement('button');
    deleteButton.className = 'btn-small';
    deleteButton.textContent = 'Delete';
    deleteButton.addEventListener('click', () => deleteHistoryItem(String(item.timestamp)));
    
    historyActions.appendChild(deleteButton);
    
    historyInfo.appendChild(historyUrl);
    historyInfo.appendChild(historyTime);
    
    historyItem.appendChild(historyInfo);
    historyItem.appendChild(historyActions);
    
    historyList.appendChild(historyItem);
  });
}

// Settings management
function initializeSettings() {
  // Load settings
  browser.storage.local.get('settings').then(result => {
    const settings = result.settings || {
      enableNotifications: true,
      enableSounds: false
    };
    
    document.getElementById('enable-notifications').checked = settings.enableNotifications;
    document.getElementById('enable-sounds').checked = settings.enableSounds;
  });
  
  // Save settings on change
  document.getElementById('enable-notifications').addEventListener('change', saveSettings);
  document.getElementById('enable-sounds').addEventListener('change', saveSettings);
  
  // Clear all data button
  document.getElementById('clear-all-data').addEventListener('click', async () => {
    if (confirm('Are you sure you want to clear all data? This cannot be undone.')) {
      try {
        await browser.storage.local.clear();
        statistics = {
          totalSaved: 0,
          totalRestored: 0,
          uniqueDomains: new Set(),
          domainStats: {},
          history: []
        };
        updateStatisticsDisplay();
        showToast('All data cleared successfully', 'success');
        updateButtonStates();
      } catch (error) {
        showToast('Failed to clear data', 'error');
      }
    }
  });
  
  // Export/Import buttons
  document.getElementById('export-data').addEventListener('click', exportData);
  document.getElementById('import-data').addEventListener('click', importData);
  document.getElementById('clear-history').addEventListener('click', clearHistory);
}

async function saveSettings() {
  const settings = {
    enableNotifications: document.getElementById('enable-notifications').checked,
    enableSounds: document.getElementById('enable-sounds').checked
  };
  
  await browser.storage.local.set({ settings });
}

// Export/Import functionality
async function exportData() {
  try {
    const data = await browser.storage.local.get(null);
    const dataStr = JSON.stringify(data, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const url = URL.createObjectURL(dataBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `form-remembrancer-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
    showToast('Data exported successfully', 'success');
  } catch (error) {
    showToast('Failed to export data', 'error');
  }
}

async function importData() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  
  input.onchange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      await browser.storage.local.clear();
      await browser.storage.local.set(data);
      
      await loadStatistics();
      updateButtonStates();
      showToast('Data imported successfully', 'success');
    } catch (error) {
      showToast('Failed to import data', 'error');
    }
  };
  
  input.click();
}

async function clearHistory() {
  if (confirm('Are you sure you want to clear all history?')) {
    try {
      statistics.history = [];
      await browser.storage.local.set({ 
        statistics: {
          ...statistics,
          uniqueDomains: Array.from(statistics.uniqueDomains)
        }
      });
      loadHistoryTab();
      showToast('History cleared successfully', 'success');
    } catch (error) {
      showToast('Failed to clear history', 'error');
    }
  }
}

async function deleteHistoryItem(timestamp) {
  try {
    statistics.history = statistics.history.filter(item => item.timestamp != timestamp);
    await browser.storage.local.set({ 
      statistics: {
        ...statistics,
        uniqueDomains: Array.from(statistics.uniqueDomains)
      }
    });
    loadHistoryTab();
    showToast('History item deleted', 'success');
  } catch (error) {
    showToast('Failed to delete history item', 'error');
  }
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

// History search functionality
document.getElementById('history-search')?.addEventListener('input', (event) => {
  const searchTerm = event.target.value.toLowerCase();
  const historyItems = document.querySelectorAll('.history-item');
  
  historyItems.forEach(item => {
    const text = item.textContent.toLowerCase();
    if (text.includes(searchTerm)) {
      item.style.display = 'flex';
    } else {
      item.style.display = 'none';
    }
  });
});

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