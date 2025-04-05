// content.js
console.log("Text extractor content script loaded");

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
      success: true
    };
  } catch (error) {
    console.error("Error extracting content:", error);
    return {
      error: error.message,
      success: false
    };
  }
}

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Content script received message:", request);
  
  if (request.action === "extractContent") {
    console.log("Extracting content from page");
    const result = extractPageContent();
    console.log("Extraction result:", result);
    sendResponse(result);
  }
  
  return true; // Keep the message channel open for async response
});