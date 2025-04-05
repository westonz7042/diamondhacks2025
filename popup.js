// popup.js
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('extract').addEventListener('click', extractContent);
});

async function extractContent() {
  try {
    // Show loading state
    const resultElement = document.getElementById('result');
    resultElement.innerHTML = '<p>Extracting and cleaning content...</p>';
    
    // Get the active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Send message to the background script to handle content extraction and cleanup
    chrome.runtime.sendMessage(
      { action: "extract", tabId: tab.id },
      (response) => {
        if (chrome.runtime.lastError) {
          resultElement.innerHTML = `<p>Error: ${chrome.runtime.lastError.message}</p>`;
          return;
        }
        
        if (!response || !response.success) {
          resultElement.innerHTML = `<p>Extraction failed: ${response?.error || 'Unknown error'}</p>`;
          return;
        }
        
        // Display the extracted and cleaned content
        resultElement.innerHTML = `
          <h4>${response.title || 'Extracted Content'}</h4>
          <div>${response.content}</div>
        `;
        
        // Save to clipboard
        navigator.clipboard.writeText(response.content)
          .then(() => {
            document.getElementById('clipboard-status').textContent = 'Cleaned content copied to clipboard!';
          })
          .catch(err => {
            console.error('Could not copy text: ', err);
          });
      }
    );
  } catch (error) {
    console.error("Error in popup script:", error);
    document.getElementById('result').innerHTML = `<p>Error: ${error.message}</p>`;
  }
}