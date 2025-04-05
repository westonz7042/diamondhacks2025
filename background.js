// background.js
// We get the API key from storage now
let API_KEY = "";

// Function to create the endpoint URL with the latest API key
function getEndpoint() {
  return `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;
}

chrome.runtime.onInstalled.addListener(() => {
  console.log("Extension installed");
});

// Function to clean up text using Gemini API
async function cleanupTextWithAPI(text, apiKey) {
  // Use the API key passed from the request
  API_KEY = apiKey;
  
  try {
    const response = await fetch(getEndpoint(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `Extract and clean the content from this webpage text. Keep the important information including title, main body, and key points. Remove navigation elements, ads, footers, and other non-essential content:\n\n${text}`,
              },
            ],
          },
        ],
      }),
    });

    const data = await response.json();
    if (data.error) {
      console.error("API Error:", data.error);
      return { error: data.error.message, success: false };
    }

    const cleanedText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!cleanedText) {
      console.error("No cleaned text found in the response.");
      return { error: "No cleaned text found in response", success: false };
    }

    console.log("✨ Text cleaned successfully");
    return { content: cleanedText, success: true };
  } catch (error) {
    console.error("Text cleanup request failed:", error);
    return { error: error.message, success: false };
  }
}

// This listener will be called when the popup requests content extraction
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "extract") {
    console.log("Extraction requested for tab:", request.tabId);
    
    // Store API key for use by other parts of the extension
    if (request.apiKey) {
      chrome.storage.sync.set({apiKey: request.apiKey});
      API_KEY = request.apiKey;
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
      }, async (response) => {
        console.log("Got response from content script:", response);
        
        if (response && response.success) {
          try {
            // Clean up the extracted text
            console.log("Cleaning up extracted text...");
            const cleanedResponse = await cleanupTextWithAPI(response.content, request.apiKey);
            
            if (cleanedResponse.success) {
              // Return the cleaned text
              sendResponse({
                title: response.title,
                content: cleanedResponse.content,
                success: true
              });
            } else {
              // If cleanup failed, return the original text
              console.warn("Text cleanup failed, returning original text");
              sendResponse(response);
            }
          } catch (error) {
            console.error("Error in text cleanup:", error);
            sendResponse(response); // Return original text if cleanup fails
          }
        } else {
          // Just pass through the failed response
          sendResponse(response);
        }
      });
    }).catch(error => {
      console.error("Error injecting content script:", error);
      sendResponse({ success: false, error: error.message });
    });
    
    return true; // Keep the message channel open for async response
  }
});