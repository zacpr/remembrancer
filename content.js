// Enhanced content script with statistics tracking and improved form detection

// Global variables
let formObserver = null;
let detectedForms = [];
let lastSaveTime = 0;

// Initialize content script
(function() {
  console.log('Form State Remembrancer - Enhanced Content Script Loaded');
  
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
  });
  
  // Also find form-like elements that might not be in <form> tags
  const formContainers = document.querySelectorAll('[role="form"], .form, .login-form, .signup-form');
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
    }
  });
  
  console.log(`Detected ${detectedForms.length} form(s) on page`);
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
    switch (message.action) {
      case 'save':
        handleSaveAction();
        sendResponse({ success: true });
        break;
        
      case 'restore':
        handleRestoreAction();
        sendResponse({ success: true });
        break;
        
      case 'countForms':
        const count = detectForms();
        sendResponse({ count });
        break;
        
      case 'getFormData':
        const formData = getFormData();
        sendResponse({ data: formData });
        break;
        
      default:
        sendResponse({ success: false, error: 'Unknown action' });
    }
  });
}

// Enhanced save functionality with statistics
async function handleSaveAction() {
  try {
    const formData = getFormData();
    const url = window.location.href;
    const timestamp = Date.now();
    
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
    
    // Save to storage
    await browser.storage.local.set({ [url]: saveData });
    
    // Add visual feedback
    showSaveFeedback();
    
    // Track statistics
    await trackStatistics('save', saveData);
    
    console.log('Form state saved successfully with enhanced data');
    
  } catch (error) {
    console.error('Error saving form state:', error);
    throw error;
  }
}

// Enhanced restore functionality
async function handleRestoreAction() {
  try {
    const url = window.location.href;
    const result = await browser.storage.local.get(url);
    const saveData = result[url];
    
    if (saveData && saveData.formData) {
      await restoreFormData(saveData.formData);
      
      // Add visual feedback
      showRestoreFeedback();
      
      // Track statistics
      await trackStatistics('restore', saveData);
      
      console.log('Form state restored successfully');
    } else {
      console.log('No form data found for current URL');
    }
  } catch (error) {
    console.error('Error restoring form state:', error);
    throw error;
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
async function restoreFormData(formData) {
  if (!formData || typeof formData !== 'object') return;
  
  const metadata = formData._metadata;
  delete formData._metadata;
  
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
async function trackStatistics(action, data) {
  try {
    const result = await browser.storage.local.get('statistics');
    let statistics = result.statistics || {
      totalSaved: 0,
      totalRestored: 0,
      uniqueDomains: [],
      domainStats: {},
      history: []
    };
    
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
    
    // Add to history
    statistics.history.unshift({
      url: url,
      domain: domain,
      action: action,
      timestamp: Date.now(),
      formCount: data.metadata?.formCount || 0
    });
    
    // Keep only last 100 history items
    if (statistics.history.length > 100) {
      statistics.history = statistics.history.slice(0, 100);
    }
    
    await browser.storage.local.set({ statistics });
    
  } catch (error) {
    console.error('Error tracking statistics:', error);
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