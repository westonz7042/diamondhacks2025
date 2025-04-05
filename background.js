// background.js
chrome.runtime.onInstalled.addListener(() => {
  console.log("Extension installed");
});

// This listener will be called when the popup requests content extraction
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "extract") {
    console.log("Extraction requested for tab:", request.tabId);
    
    // Store API key for use by other parts of the extension
    if (request.apiKey) {
      chrome.storage.sync.set({apiKey: request.apiKey});
    }
    
    // Execute content script
    chrome.scripting.executeScript({
      target: { tabId: request.tabId },
      files: ["readability.js", "content.js"]
    }).then(() => {
      // Now that the content script is injected, send a message to it
      chrome.tabs.sendMessage(request.tabId, { 
        action: "extractContent",
        apiKey: request.apiKey 
      }, (response) => {
        console.log("Got response from content script:", response);
        sendResponse(response);
      });
    }).catch(error => {
      console.error("Error injecting content script:", error);
      sendResponse({ success: false, error: error.message });
    });
    
    return true; // Keep the message channel open for async response
  }
});