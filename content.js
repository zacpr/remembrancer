// Enhanced content script with statistics tracking and improved form detection

// Global variables
let formObserver = null;
let detectedForms = [];
let lastSaveTime = 0;
let isPrivateBrowsing = false;

// Initialize content script
(function() {
  console.log('Form State Remembrancer - Enhanced Content Script Loaded');
  
  // Check private browsing mode
  checkPrivateBrowsing();
  
  // Initial form detection
  detectForms();
  
  // Set up mutation observer for dynamic forms
  setupFormObserver();
  
  // Set up message listeners
  setupMessageListeners();
  
  // Auto-restore if enabled
  checkAutoRestore();
})();

// Form detection with improved accuracy
function detectForms() {
  detectedForms = [];
  
  // Find all form elements
  const forms = document.querySelectorAll('form');
  console.log(`Found ${forms.length} <form> elements`);
  
  forms.forEach((form, index) => {
    const formInfo = {
      element: form,
      index: index,
      id: form.id || `form-${index}`,
      action: form.action,
      method: form.method,
      inputCount: form.querySelectorAll('input, textarea, select').length
    };
    detectedForms.push(formInfo);
    console.log(`Form ${index}: id=${formInfo.id}, inputs=${formInfo.inputCount}`);
  });
  
  // Also find form-like elements that might not be in <form> tags
  const formContainers = document.querySelectorAll('[role="form"], .form, .login-form, .signup-form');
  console.log(`Found ${formContainers.length} form-like containers`);
  
  formContainers.forEach((container, index) => {
    if (!forms.includes(container)) {
      const formInfo = {
        element: container,
        index: forms.length + index,
        id: container.id || `container-${index}`,
        action: 'container',
        method: 'container',
        inputCount: container.querySelectorAll('input, textarea, select').length
      };
      detectedForms.push(formInfo);
      console.log(`Container ${index}: id=${formInfo.id}, inputs=${formInfo.inputCount}`);
    }
  });
  
  console.log(`Total detected forms: ${detectedForms.length}`);
  return detectedForms.length;
}

// Set up mutation observer for dynamic content
function setupFormObserver() {
  if (formObserver) {
    formObserver.disconnect();
  }
  
  formObserver = new MutationObserver((mutations) => {
    let shouldRedetect = false;
    
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList') {
        // Check if any forms were added or removed
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.tagName === 'FORM' || 
                node.querySelector('form') || 
                node.querySelector('[role="form"]') ||
                node.querySelector('input, textarea, select')) {
              shouldRedetect = true;
            }
          }
        });
        
        mutation.removedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.tagName === 'FORM' || node.querySelector('form')) {
              shouldRedetect = true;
            }
          }
        });
      }
    });
    
    if (shouldRedetect) {
      setTimeout(detectForms, 100);
    }
  });
  
  formObserver.observe(document.body, {
    childList: true,
    subtree: true
  });
}

// Enhanced message handling
function setupMessageListeners() {
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Content: Received message:', message.action);
    
    switch (message.action) {
      case 'save':
        handleSaveAction().then(() => {
          console.log('Content: Save completed successfully');
          sendResponse({ success: true });
        }).catch((error) => {
          console.error('Content: Save action failed:', error);
          sendResponse({ success: false, error: error.message });
        });
        return true; // Keep message channel open for async response
        
      case 'restore':
        handleRestoreAction().then(() => {
          console.log('Content: Restore completed successfully');
          sendResponse({ success: true });
        }).catch((error) => {
          console.error('Content: Restore action failed:', error);
          sendResponse({ success: false, error: error.message });
        });
        return true; // Keep message channel open for async response
        
      case 'restoreFormData':
        try {
          console.log('Content: Restoring form data directly:', message.data);
          await restoreFormData(message.data);
          showRestoreFeedback();
          sendResponse({ success: true });
        } catch (error) {
          console.error('Content: Direct restore failed:', error);
          sendResponse({ success: false, error: error.message });
        }
        break;
        
      case 'countForms':
        const count = detectForms();
        console.log('Content: Form count requested, returning:', count);
        sendResponse({ count });
        break;
        
      case 'getFormData':
        const formData = getFormData();
        console.log('Content: Form data requested, returning:', formData);
        sendResponse({ data: formData });
        break;
        
      default:
        console.log('Content: Unknown action:', message.action);
        sendResponse({ success: false, error: 'Unknown action' });
    }
  });
}

// Enhanced save functionality with statistics
function handleSaveAction() {
  try {
    console.log('Content: Starting save action...');
    
    // First detect forms to ensure we have current data
    detectForms();
    
    // Check if we have any forms to save
    if (detectedForms.length === 0) {
      console.log('Content: No forms detected on page');
      return Promise.reject(new Error('No forms found on this page to save'));
    }
    
    const formData = getFormData();
    const url = window.location.href;
    const timestamp = Date.now();
    
    console.log('Content: Form data extracted:', formData);
    console.log('Content: Detected forms count:', detectedForms.length);
    
    // Check if we have any form data to save
    const hasFormData = formData && Object.keys(formData).length > 1; // More than just _metadata
    if (!hasFormData) {
      console.log('Content: No form data to save');
      return Promise.reject(new Error('No form data found to save'));
    }
    
    // Enhanced data structure with metadata
    const saveData = {
      formData: formData,
      metadata: {
        url: url,
        domain: new URL(url).hostname,
        title: document.title,
        timestamp: timestamp,
        formCount: detectedForms.length,
        userAgent: navigator.userAgent.substring(0, 100) // Truncated for privacy
      }
    };
    
    console.log('Content: Saving data to storage:', saveData);
    
    // Save to storage
    return browser.storage.local.set({ [url]: saveData }).then(() => {
      console.log('Content: Data saved to storage successfully');
      
      // Verify it was saved
      return browser.storage.local.get(url).then((verifyResult) => {
        console.log('Content: Verification - saved data:', verifyResult);
        
        if (!verifyResult[url]) {
          console.error('Content: Failed to verify saved data in storage');
          return Promise.reject(new Error('Failed to verify saved data in storage'));
        }
        
        // Add visual feedback
        showSaveFeedback();
        
        // Track statistics
        return trackStatistics('save', saveData).then(() => {
          console.log('Content: Form state saved successfully with enhanced data');
        });
      });
    });
    
  } catch (error) {
    console.error('Content: Error saving form state:', error);
    return Promise.reject(error);
  }
}

// Enhanced restore functionality
function handleRestoreAction() {
  try {
    console.log('Content: Starting restore action...');
    const url = window.location.href;
    console.log('Content: Current URL for restore:', url);
    
    return browser.storage.local.get(url).then((result) => {
      console.log('Content: Retrieved data from storage:', result);
      
      const saveData = result[url];
      
      if (saveData && saveData.formData) {
        console.log('Content: Found saved data, restoring form data:', saveData.formData);
        
        return restoreFormData(saveData.formData).then(() => {
          // Add visual feedback
          showRestoreFeedback();
          
          // Track statistics
          return trackStatistics('restore', saveData).then(() => {
            console.log('Content: Form state restored successfully');
          });
        });
      } else {
        console.log('Content: No form data found for current URL');
        console.log('Content: Available keys in storage:', Object.keys(result));
        return Promise.reject(new Error('No saved form data found for this page'));
      }
    });
    
  } catch (error) {
    console.error('Content: Error restoring form state:', error);
    return Promise.reject(error);
  }
}

// Enhanced form data extraction
function getFormData() {
  const allInputs = document.querySelectorAll('input, textarea, select');
  const data = {};
  const metadata = {
    totalInputs: allInputs.length,
    timestamp: Date.now()
  };
  
  allInputs.forEach((input, index) => {
    // Create a more robust key generation
    const key = generateInputKey(input, index);
    
    let value;
    switch (input.type) {
      case 'checkbox':
      case 'radio':
        value = input.checked;
        break;
      case 'file':
        // Don't store file data, just indicate that a file was selected
        value = input.files.length > 0 ? '[FILE_SELECTED]' : '';
        break;
      case 'password':
        // Mask passwords for security
        value = input.value ? '[PASSWORD]' : '';
        break;
      default:
        value = input.value;
    }
    
    // Store additional metadata for each input
    data[key] = {
      value: value,
      type: input.type,
      tagName: input.tagName,
      name: input.name,
      id: input.id,
      className: input.className,
      index: index
    };
  });
  
  // Add metadata
  data['_metadata'] = metadata;
  
  return data;
}

// Generate robust input keys
function generateInputKey(input, index) {
  const parts = [
    input.tagName.toLowerCase(),
    input.type || 'text',
    input.name || input.id || `unnamed-${index}`,
    index
  ];
  
  return parts.join('_');
}

// Enhanced form restoration
function restoreFormData(formData) {
  if (!formData || typeof formData !== 'object') return Promise.resolve();
  
  const metadata = formData._metadata;
  delete formData._metadata;
  
  return new Promise((resolve, reject) => {
    try {
      // Restore each input
      Object.entries(formData).forEach(([key, inputData]) => {
        if (key === '_metadata') return;
        
        try {
          // Find the input element
          const input = findInputByKey(key, inputData);
          if (!input) return;
          
          // Restore the value based on input type
          switch (inputData.type) {
            case 'checkbox':
            case 'radio':
              input.checked = inputData.value;
              break;
            case 'file':
              // Can't restore file inputs, just skip
              break;
            case 'password':
              // Don't restore passwords for security
              break;
            default:
              input.value = inputData.value;
              
              // Trigger change events for better compatibility
              input.dispatchEvent(new Event('change', { bubbles: true }));
              input.dispatchEvent(new Event('input', { bubbles: true }));
          }
        } catch (error) {
          console.warn(`Failed to restore input ${key}:`, error);
        }
      });
      
      // Trigger form events for better compatibility
      detectedForms.forEach(formInfo => {
        if (formInfo.element) {
          formInfo.element.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
      
      resolve();
    } catch (error) {
      console.error('Error in restoreFormData:', error);
      reject(error);
    }
  });
}

// Find input element by key
function findInputByKey(key, inputData) {
  // Try to find by ID first
  if (inputData.id) {
    const element = document.getElementById(inputData.id);
    if (element) return element;
  }
  
  // Try to find by name
  if (inputData.name) {
    const element = document.querySelector(`[name="${inputData.name}"]`);
    if (element) return element;
  }
  
  // Try to find by type and index
  const allInputs = document.querySelectorAll(`${inputData.tagName.toLowerCase()}[type="${inputData.type}"]`);
  if (allInputs[inputData.index]) {
    return allInputs[inputData.index];
  }
  
  // Fallback: try to find by class name
  if (inputData.className) {
    const element = document.querySelector(`.${inputData.className.split(' ')[0]}`);
    if (element) return element;
  }
  
  return null;
}

// Auto-restore functionality
async function checkAutoRestore() {
  try {
    const result = await browser.storage.local.get('autoRestore');
    const autoRestore = result.autoRestore || {};
    
    if (autoRestore[window.location.href]) {
      // Wait a bit for the page to fully load
      setTimeout(async () => {
        await handleRestoreAction();
      }, 1000);
    }
  } catch (error) {
    console.error('Error checking auto-restore:', error);
  }
}

// Statistics tracking
function trackStatistics(action, data) {
  try {
    return browser.storage.local.get(['statistics', 'settings']).then((result) => {
      let statistics = result.statistics || {
        totalSaved: 0,
        totalRestored: 0,
        uniqueDomains: [],
        domainStats: {},
        history: []
      };
      
      const settings = result.settings || {};
      
      // Check if statistics are enabled
      if (!settings.enableStatistics) {
        return Promise.resolve();
      }
      
      const url = data.metadata?.url || window.location.href;
      const domain = data.metadata?.domain || new URL(url).hostname;
      
      if (action === 'save') {
        statistics.totalSaved++;
      } else if (action === 'restore') {
        statistics.totalRestored++;
      }
      
      // Update domain statistics
      if (!statistics.domainStats[domain]) {
        statistics.domainStats[domain] = { saves: 0, restores: 0 };
      }
      
      if (action === 'save') {
        statistics.domainStats[domain].saves++;
      } else if (action === 'restore') {
        statistics.domainStats[domain].restores++;
      }
      
      // Update unique domains
      if (!statistics.uniqueDomains.includes(domain)) {
        statistics.uniqueDomains.push(domain);
      }
      
      // Add to history if enabled
      if (settings.enableHistory) {
        statistics.history.unshift({
          url: url,
          domain: domain,
          action: action,
          timestamp: Date.now(),
          formCount: data.metadata?.formCount || 0,
          isPrivate: isPrivateBrowsing
        });
        
        // Keep only last 100 history items
        if (statistics.history.length > 100) {
          statistics.history = statistics.history.slice(0, 100);
        }
      }
      
      return browser.storage.local.set({ statistics });
    });
    
  } catch (error) {
    console.error('Error tracking statistics:', error);
    return Promise.reject(error);
  }
}

// Visual feedback functions
function showSaveFeedback() {
  // Create a subtle visual indicator
  const indicator = document.createElement('div');
  indicator.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    font-weight: 500;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    z-index: 10000;
    animation: slideInRight 0.3s ease;
  `;
  indicator.textContent = '✓ Form saved';
  
  document.body.appendChild(indicator);
  
  setTimeout(() => {
    indicator.style.animation = 'slideOutRight 0.3s ease';
    setTimeout(() => {
      if (indicator.parentNode) {
        indicator.parentNode.removeChild(indicator);
      }
    }, 300);
  }, 2000);
}

function showRestoreFeedback() {
  const indicator = document.createElement('div');
  indicator.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    font-weight: 500;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    z-index: 10000;
    animation: slideInRight 0.3s ease;
  `;
  indicator.textContent = '↩ Form restored';
  
  document.body.appendChild(indicator);
  
  setTimeout(() => {
    indicator.style.animation = 'slideOutRight 0.3s ease';
    setTimeout(() => {
      if (indicator.parentNode) {
        indicator.parentNode.removeChild(indicator);
      }
    }, 300);
  }, 2000);
}

// Add CSS animations for feedback
const style = document.createElement('style');
style.textContent = `
  @keyframes slideInRight {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  @keyframes slideOutRight {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(100%);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (formObserver) {
    formObserver.disconnect();
  }
});

// Expose some functions for debugging (in development)
if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
  window.formRemembrancerDebug = {
    detectForms,
    getFormData,
    detectedForms
  };
}