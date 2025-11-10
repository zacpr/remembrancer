// Ultra-simplified, bulletproof popup script
console.log('Popup: Ultra-simplified version loaded');

// Initialize the popup
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Popup: DOM content loaded');
  
  try {
    // Get current tab
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tabs[0]) {
      console.error('No active tab found');
      return;
    }
    
    const currentTab = tabs[0];
    const url = currentTab.url;
    console.log('Current tab URL:', url);
    
    // Update page info
    document.getElementById('current-url').textContent = new URL(url).hostname;
    
    // Check for saved data
    const result = await browser.storage.local.get(url);
    const hasData = result[url] && result[url].formData;
    console.log('Has saved data:', hasData);
    
    // Update button states
    const saveButton = document.getElementById('save-button');
    const restoreButton = document.getElementById('restore-button');
    const forgetButton = document.getElementById('forget-button');
    const autoRestoreButton = document.getElementById('auto-restore-button');
    
    if (hasData) {
      // Data exists - disable save, enable others
      saveButton.disabled = true;
      saveButton.classList.add('has-form-data');
      restoreButton.disabled = false;
      restoreButton.classList.remove('no-form-data');
      forgetButton.disabled = false;
      forgetButton.classList.remove('no-form-data');
      autoRestoreButton.disabled = false;
      autoRestoreButton.classList.remove('no-form-data');
    } else {
      // No data - enable save, disable others
      saveButton.disabled = false;
      saveButton.classList.remove('has-form-data');
      restoreButton.disabled = true;
      restoreButton.classList.add('no-form-data');
      forgetButton.disabled = true;
      forgetButton.classList.add('no-form-data');
      autoRestoreButton.disabled = true;
      autoRestoreButton.classList.add('no-form-data');
    }
    
    // Save button click handler
    saveButton.addEventListener('click', async () => {
      console.log('Save button clicked');
      
      try {
        // Get form data from content script
        const response = await browser.tabs.sendMessage(currentTab.id, { action: 'getFormData' });
        console.log('Form data response:', response);
        
        if (response && response.data && Object.keys(response.data).length > 1) {
          // Save to storage
          const saveData = {
            formData: response.data,
            timestamp: Date.now(),
            url: url
          };
          
          await browser.storage.local.set({ [url]: saveData });
          console.log('Data saved successfully');
          
          // Update UI
          saveButton.disabled = true;
          saveButton.classList.add('has-form-data');
          restoreButton.disabled = false;
          restoreButton.classList.remove('no-form-data');
          forgetButton.disabled = false;
          forgetButton.classList.remove('no-form-data');
          autoRestoreButton.disabled = false;
          autoRestoreButton.classList.remove('no-form-data');
          
          // Show success message
          showToast('Form saved successfully!', 'success');
        } else {
          showToast('No form data to save', 'error');
        }
        
      } catch (error) {
        console.error('Save error:', error);
        showToast('Save failed: ' + error.message, 'error');
      }
    });
    
    // Restore button click handler
    restoreButton.addEventListener('click', async () => {
      console.log('Restore button clicked');
      
      try {
        // Get saved data from storage
        const result = await browser.storage.local.get(url);
        const saveData = result[url];
        console.log('Saved data:', saveData);
        
        if (saveData && saveData.formData) {
          // Send to content script
          const response = await browser.tabs.sendMessage(currentTab.id, { 
            action: 'restoreFormData', 
            data: saveData.formData 
          });
          console.log('Restore response:', response);
          
          if (response && response.success) {
            showToast('Form restored successfully!', 'success');
          } else {
            showToast('Restore failed', 'error');
          }
        } else {
          showToast('No saved data found', 'error');
        }
        
      } catch (error) {
        console.error('Restore error:', error);
        showToast('Restore failed: ' + error.message, 'error');
      }
    });
    
    // Forget button click handler
    forgetButton.addEventListener('click', async () => {
      console.log('Forget button clicked');
      
      try {
        // Remove from storage
        await browser.storage.local.remove(url);
        console.log('Data removed successfully');
        
        // Update UI
        saveButton.disabled = false;
        saveButton.classList.remove('has-form-data');
        restoreButton.disabled = true;
        restoreButton.classList.add('no-form-data');
        forgetButton.disabled = true;
        forgetButton.classList.add('no-form-data');
        autoRestoreButton.disabled = true;
        autoRestoreButton.classList.add('no-form-data');
        
        showToast('Data forgotten successfully', 'success');
        
      } catch (error) {
        console.error('Forget error:', error);
        showToast('Forget failed: ' + error.message, 'error');
      }
    });
    
    // Auto-restore button click handler
    autoRestoreButton.addEventListener('click', async () => {
      console.log('Auto-restore button clicked');
      
      try {
        // Get current state
        const result = await browser.storage.local.get(['autoRestore', url]);
        const autoRestore = result.autoRestore || {};
        const currentState = autoRestore[url] || false;
        
        // Toggle state
        autoRestore[url] = !currentState;
        await browser.storage.local.set({ autoRestore });
        
        // Update button text
        autoRestoreButton.textContent = !currentState ? 'Disable Auto-Restore' : 'Enable Auto-Restore';
        
        showToast(`Auto-restore ${!currentState ? 'enabled' : 'disabled'}`, 'success');
        
      } catch (error) {
        console.error('Auto-restore error:', error);
        showToast('Auto-restore failed: ' + error.message, 'error');
      }
    });
    
  } catch (error) {
    console.error('Popup initialization error:', error);
  }
});

// Simple toast notification
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.add('hide');
    setTimeout(() => {
      container.removeChild(toast);
    }, 300);
  }, 3000);
}

// Simple loading overlay
function showLoading(show) {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) {
    if (show) {
      overlay.classList.add('active');
    } else {
      overlay.classList.remove('active');
    }
  }
}