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

// Initialize the popup
document.addEventListener('DOMContentLoaded', async () => {
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
  // Save button
  document.getElementById('save-button').addEventListener('click', async () => {
    showLoading(true);
    try {
      await browser.runtime.sendMessage({ action: 'save' });
      await recordStatistics('save');
      showToast('Form state saved successfully!', 'success');
      setTimeout(updateButtonStates, 100);
    } catch (error) {
      showToast('Failed to save form state', 'error');
    } finally {
      showLoading(false);
    }
  });

  // Restore button
  document.getElementById('restore-button').addEventListener('click', async () => {
    showLoading(true);
    try {
      await browser.runtime.sendMessage({ action: 'restore' });
      await recordStatistics('restore');
      showToast('Form state restored successfully!', 'success');
    } catch (error) {
      showToast('Failed to restore form state', 'error');
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
      forgetButtonState = 'confirm';
      button.querySelector('.btn-text').textContent = 'Forget, you sure?';
      button.classList.add('confirming');
    } else if (forgetButtonState === 'confirm') {
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
        button.classList.remove('confirming');
        
        updateButtonStates();
        await loadStatistics();
      } catch (error) {
        showToast('Failed to forget form data', 'error');
      } finally {
        showLoading(false);
      }
    }
  });
}

// Update button states based on stored form data
async function updateButtonStates() {
  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    const url = tabs[0].url;
    
    const result = await browser.storage.local.get(url);
    const hasFormData = result[url] !== undefined;
    
    const restoreButton = document.getElementById('restore-button');
    const autoRestoreButton = document.getElementById('auto-restore-button');
    const forgetButton = document.getElementById('forget-button');
    
    // Enable/disable buttons based on form data existence
    restoreButton.disabled = !hasFormData;
    autoRestoreButton.disabled = !hasFormData;
    forgetButton.disabled = !hasFormData;
    
    // Update auto-restore button text
    const autoRestoreResult = await browser.storage.local.get('autoRestore');
    const autoRestore = autoRestoreResult.autoRestore || {};
    const isAutoRestoreEnabled = autoRestore[url] === true;
    
    autoRestoreButton.querySelector('.btn-text').textContent = isAutoRestoreEnabled ?
      'Disable Auto-Restore' : 'Enable Auto-Restore';
    
    // Reset forget button state
    if (forgetButtonState === 'confirm') {
      forgetButtonState = 'normal';
      forgetButton.querySelector('.btn-text').textContent = 'Forget Data';
      forgetButton.classList.remove('confirming');
    }
  } catch (error) {
    console.error('Error updating button states:', error);
  }
}

// Update current page information
async function updateCurrentPageInfo() {
  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    const url = tabs[0].url;
    const domain = new URL(url).hostname;
    
    document.getElementById('current-url').textContent = domain;
    
    // Count forms on current page
    const forms = await browser.tabs.sendMessage(tabs[0].id, { action: 'countForms' });
    document.getElementById('form-count').textContent = `${forms} form${forms !== 1 ? 's' : ''} found`;
  } catch (error) {
    document.getElementById('current-url').textContent = 'No page detected';
    document.getElementById('form-count').textContent = '0 forms found';
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
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    const url = tabs[0].url;
    const domain = new URL(url).hostname;
    
    if (action === 'save') {
      statistics.totalSaved++;
    } else if (action === 'restore') {
      statistics.totalRestored++;
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
    
    await browser.storage.local.set({ 
      statistics: {
        ...statistics,
        uniqueDomains: Array.from(statistics.uniqueDomains)
      }
    });
    
    updateStatisticsDisplay();
  } catch (error) {
    console.error('Error recording statistics:', error);
  }
}

function updateStatisticsDisplay() {
  document.getElementById('total-forms').textContent = `${statistics.totalSaved} forms`;
  document.getElementById('total-saved').textContent = statistics.totalSaved;
  document.getElementById('total-restored').textContent = statistics.totalRestored;
  document.getElementById('unique-domains').textContent = statistics.uniqueDomains.size;
}

function loadStatisticsTab() {
  // Update domain statistics
  const domainList = document.getElementById('domain-list');
  domainList.innerHTML = '';
  
  const sortedDomains = Object.entries(statistics.domainStats)
    .sort(([,a], [,b]) => (b.saves + b.restores) - (a.saves + a.restores))
    .slice(0, 5);
  
  sortedDomains.forEach(([domain, stats]) => {
    const item = document.createElement('div');
    item.className = 'domain-item';
    item.innerHTML = `
      <span class="domain-name">${domain}</span>
      <span class="domain-count">${stats.saves + stats.restores}</span>
    `;
    domainList.appendChild(item);
  });
  
  // Draw usage chart
  drawUsageChart();
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
    
    const date = new Date(item.timestamp);
    const timeString = date.toLocaleString('en', { 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    
    historyItem.innerHTML = `
      <div class="history-info">
        <div class="history-url">${item.domain}</div>
        <div class="history-time">${timeString} - ${item.action}</div>
      </div>
      <div class="history-actions">
        <button class="btn-small" onclick="deleteHistoryItem('${item.timestamp}')">Delete</button>
      </div>
    `;
    
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