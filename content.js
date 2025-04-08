// content.js
console.log("Text extractor content script loaded");

// Helper function to clean up any duplicate buttons
function cleanupDuplicateButtons() {
  const existingButtons = document.querySelectorAll('#anki-card-creator-button');
  if (existingButtons.length > 1) {
    console.log(`Found ${existingButtons.length} highlight buttons, cleaning up duplicates`);
    // Keep the first one and remove others
    for (let i = 1; i < existingButtons.length; i++) {
      existingButtons[i].parentNode.removeChild(existingButtons[i]);
    }
  }
}

// Clean up immediately when script loads
cleanupDuplicateButtons();

// Also clean up when DOM is fully loaded
document.addEventListener("DOMContentLoaded", cleanupDuplicateButtons);

// Function to extract page content
function extractPageContent() {
  try {
    // Create a clone of the document to avoid modifying the original
    const documentClone = document.cloneNode(true);

    // Parse the document with Readability
    const reader = new Readability(documentClone);
    const article = reader.parse();

    return {
      title: article.title,
      content: article.textContent,
      success: true,
    };
  } catch (error) {
    console.error("Error extracting content:", error);
    return {
      error: error.message,
      success: false,
    };
  }
}

// Function to get the user's highlighted text
function getSelectedText() {
  const selection = window.getSelection();
  const selectedText = selection.toString().trim();
  
  if (selectedText.length === 0) {
    return {
      success: false,
      error: "No text selected",
    };
  }
  
  // Get page title for reference
  const pageTitle = document.title;
  
  return {
    title: pageTitle,
    content: selectedText,
    success: true
  };
}

// Create the floating button element
// Using window property to prevent duplicate declarations
window.floatingButton = window.floatingButton || null;
window.selectionTimeout = window.selectionTimeout || null;

function createFloatingButton() {
  // First check if button already exists in the DOM
  const existingButton = document.getElementById('anki-card-creator-button');
  if (existingButton) {
    // Use the existing button if found
    window.floatingButton = existingButton;
    return window.floatingButton;
  }
  
  // Create button if it doesn't exist in DOM or window reference
  if (!window.floatingButton) {
    window.floatingButton = document.createElement('div');
    window.floatingButton.id = 'anki-card-creator-button';
    window.floatingButton.textContent = '💾 Save Highlight';
    
    // Style the button
    Object.assign(window.floatingButton.style, {
      position: 'absolute',
      zIndex: '9999',
      background: '#4285f4',
      color: 'white',
      padding: '6px 10px',
      borderRadius: '4px',
      fontSize: '12px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
      cursor: 'pointer',
      display: 'none',
      fontFamily: 'Arial, sans-serif',
      fontWeight: 'bold',
      userSelect: 'none'
    });
    
    // Add hover effect
    window.floatingButton.addEventListener('mouseover', () => {
      window.floatingButton.style.background = '#3367d6';
    });
    
    window.floatingButton.addEventListener('mouseout', () => {
      window.floatingButton.style.background = '#4285f4';
    });
    
    // Add click handler
    window.floatingButton.addEventListener('click', handleFloatingButtonClick);
    
    // Add to document
    document.body.appendChild(window.floatingButton);
  }
  
  return window.floatingButton;
}

// Handle button click
function handleFloatingButtonClick() {
  const selectedText = getSelectedText();
  
  if (selectedText.success) {
    // Show that we're processing
    window.floatingButton.textContent = '⏳ Saving...';
    
    // Send message to background script to save the highlight
    chrome.runtime.sendMessage({
      action: 'saveHighlight',
      content: selectedText.content,
      title: selectedText.title
    }, response => {
      if (response && response.success) {
        window.floatingButton.textContent = '✅ Saved!';
        
        // Create a notification to confirm the save
        const notification = document.createElement('div');
        notification.style.position = 'fixed';
        notification.style.bottom = '20px';
        notification.style.right = '20px';
        notification.style.backgroundColor = '#4285f4';
        notification.style.color = 'white';
        notification.style.padding = '10px 15px';
        notification.style.borderRadius = '4px';
        notification.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
        notification.style.zIndex = '10000';
        notification.style.fontFamily = 'Arial, sans-serif';
        notification.style.fontSize = '14px';
        
        // Show the count of saved highlights
        const highlightCount = response.count || 0;
        notification.textContent = `Highlight saved! (${highlightCount} total). Click the extension icon to create flashcards.`;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
          notification.style.opacity = '0';
          notification.style.transition = 'opacity 0.5s';
          setTimeout(() => {
            if (notification.parentNode) {
              document.body.removeChild(notification);
            }
          }, 500);
        }, 5000);
        
        setTimeout(() => {
          // Reset button text to original state before hiding
          window.floatingButton.textContent = '💾 Save Highlight';
          hideFloatingButton();
        }, 2000);
      } else {
        const errorMsg = response && response.error ? response.error : 'Unknown error';
        console.error('Error saving highlight:', errorMsg);
        
        // Show error message
        window.floatingButton.textContent = '❌ Failed';
        window.floatingButton.title = errorMsg; // Show error on hover
        
        setTimeout(() => {
          // Reset button text to original state before hiding
          window.floatingButton.textContent = '💾 Save Highlight';
          hideFloatingButton();
        }, 2000);
      }
    });
  }
}

// Update floating button position based on selection
function updateFloatingButtonPosition() {
  const selection = window.getSelection();
  
  if (!selection || selection.rangeCount === 0 || selection.toString().trim() === '') {
    hideFloatingButton();
    return;
  }
  
  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  
  // Create button if it doesn't exist yet
  const button = createFloatingButton();
  
  // Position at the top-right of selection
  const top = rect.top + window.scrollY - button.offsetHeight - 5;
  const left = rect.right + window.scrollX - button.offsetWidth / 2;
  
  button.style.top = `${Math.max(0, top)}px`;
  button.style.left = `${Math.max(0, left)}px`;
  
  // Only show if not already visible to prevent flickering
  if (button.style.display !== 'block') {
    button.style.display = 'block';
  }
}

// Hide the floating button
function hideFloatingButton() {
  if (window.floatingButton) {
    window.floatingButton.style.display = 'none';
    // Don't change the button text here to maintain consistency
  }
}

// Listen for text selection
document.addEventListener('mouseup', () => {
  // Clear any existing timeout
  if (window.selectionTimeout) {
    clearTimeout(window.selectionTimeout);
  }
  
  // Set a small timeout to avoid flickering on normal clicks
  window.selectionTimeout = setTimeout(() => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 0) {
      updateFloatingButtonPosition();
    } else {
      hideFloatingButton();
    }
  }, 200);
});

// Handle scroll events
window.addEventListener('scroll', () => {
  const selection = window.getSelection();
  if (selection && selection.toString().trim().length > 0) {
    updateFloatingButtonPosition();
  }
});

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Content script received message:", request.action);

  if (request.action === "extractContent") {
    // Handle PDF check and content extraction
    try {
      if (request.isPDF) {
        console.log("Checking for PDF");
        extractPDFText().then((text) => {
          const result = { content: text };
          console.log("HI");
          // Pass along the API key with the result
          if (request.apiKey) {
            result.apiKey = request.apiKey;
          }
          sendResponse({...result, success: true});
        });
      } else {
        console.log("Extracting content from page");
        const result = extractPageContent();

        // Pass along the API key with the result
        if (request.apiKey) {
          result.apiKey = request.apiKey;
        }
        sendResponse(result);
      }
    } catch (error) {
      console.error("Error in checkIfPDF or extraction:", error);
      sendResponse({ success: false, error: error.message });
    }
  }

  return true; // Keep the message channel open for async response
});

async function extractPDFText() {
  const pdfjsLib = window["pdfjs-dist/build/pdf"];
  if (!pdfjsLib) {
    console.error("pdfjsLib is not loaded properly.");
    return;
  }

  pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL(
    "libs/pdf.worker.min.js"
  );
  const pdfData = await fetch(window.location.href).then((res) =>
    res.arrayBuffer()
  );

  const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;

  let text = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map((item) => item.str).join(" ");
    text += pageText + "\n";
  }
  console.log("Got PDF data:", text);
  return text;
}
