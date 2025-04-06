// background.js

// We get the API key from storage now
let API_KEY = "";

// Function to create the endpoint URL with the latest API key
function getEndpoint() {
  return `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;
}

chrome.runtime.onInstalled.addListener(() => {
  console.log("Extension installed");
  
  // Initialize saved highlights storage
  chrome.storage.local.get(['savedHighlights'], function(result) {
    if (!result.savedHighlights) {
      chrome.storage.local.set({ savedHighlights: [] });
    }
  });
});

// Functions to manage saved highlights
function getSavedHighlights() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['savedHighlights'], function(result) {
      resolve(result.savedHighlights || []);
    });
  });
}

function saveHighlight(highlight) {
  return getSavedHighlights().then(highlights => {
    highlights.push({
      ...highlight,
      id: Date.now(), // Use timestamp as unique ID
      timestamp: new Date().toISOString()
    });
    
    return new Promise((resolve) => {
      chrome.storage.local.set({ savedHighlights: highlights }, function() {
        // Update badge to show count of saved highlights
        updateHighlightBadge(highlights.length);
        resolve(highlights);
      });
    });
  });
}

function removeHighlight(highlightId) {
  return getSavedHighlights().then(highlights => {
    const updatedHighlights = highlights.filter(h => h.id !== highlightId);
    
    return new Promise((resolve) => {
      chrome.storage.local.set({ savedHighlights: updatedHighlights }, function() {
        // Update badge to show updated count
        updateHighlightBadge(updatedHighlights.length);
        resolve(updatedHighlights);
      });
    });
  });
}

function clearAllHighlights() {
  return new Promise((resolve) => {
    chrome.storage.local.set({ savedHighlights: [] }, function() {
      // Remove badge when no highlights
      updateHighlightBadge(0);
      resolve([]);
    });
  });
}

// Update the extension badge to show number of saved highlights
function updateHighlightBadge(count) {
  if (count > 0) {
    chrome.action.setBadgeText({ text: count.toString() });
    chrome.action.setBadgeBackgroundColor({ color: '#4285f4' });
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}

// Initialize badge on startup
chrome.storage.local.get(['savedHighlights'], function(result) {
  const highlights = result.savedHighlights || [];
  updateHighlightBadge(highlights.length);
});

// Function to clean up text using Gemini API
function cleanupTextWithAPI(text, apiKey) {
  // Use the API key passed from the request
  API_KEY = apiKey;
  
  return fetch(getEndpoint(), {
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
  })
  .then(response => response.json())
  .then(data => {
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
  })
  .catch(error => {
    console.error("Text cleanup request failed:", error);
    return { error: error.message, success: false };
  });
}

// This listener will be called when the popup requests content extraction or when selection-based generation is requested
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
            cleanupTextWithAPI(response.content, request.apiKey)
              .then(cleanedResponse => {
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
              })
              .catch(error => {
                console.error("Error in text cleanup:", error);
                sendResponse(response); // Return original text if cleanup fails
              });
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
  else if (request.action === "saveHighlight") {
    console.log("Saving highlight:", request.content.substring(0, 50) + "...");
    
    // Save the highlight
    const highlight = {
      content: request.content,
      title: request.title,
      url: sender.tab ? sender.tab.url : null,
      tabId: sender.tab ? sender.tab.id : null
    };
    
    // Use promise-based approach instead of await
    saveHighlight(highlight).then(highlights => {
      sendResponse({ 
        success: true, 
        message: "Highlight saved successfully",
        count: highlights.length
      });
    }).catch(error => {
      console.error("Error saving highlight:", error);
      sendResponse({ 
        success: false, 
        error: error.message || "Failed to save highlight" 
      });
    });
    
    return true; // Keep the message channel open for async response
  }
  else if (request.action === "getHighlights") {
    getSavedHighlights().then(highlights => {
      sendResponse({ success: true, highlights });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    
    return true; // Keep the message channel open for async response
  }
  else if (request.action === "removeHighlight") {
    removeHighlight(request.highlightId).then(highlights => {
      sendResponse({ success: true, highlights });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    
    return true; // Keep the message channel open for async response
  }
  else if (request.action === "clearHighlights") {
    clearAllHighlights().then(() => {
      sendResponse({ success: true });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    
    return true; // Keep the message channel open for async response
  }
  else if (request.action === "generateFromSelection") {
    console.log("Generating flashcards from selection:", request.content.substring(0, 100) + "...");
    
    // Store or use the API key
    if (request.apiKey) {
      API_KEY = request.apiKey;
    } else {
      // If no API key provided, try to get from storage
      chrome.storage.sync.get(["apiKey"], function(result) {
        if (result.apiKey) {
          API_KEY = result.apiKey;
        }
      });
    }
    
    // Make sure we have an API key
    if (!API_KEY) {
      console.error("No API key available");
      sendResponse({ success: false, error: "No API key available. Please enter your API key in the extension popup." });
      return true;
    }
    
    // Call the Gemini API directly here, rather than using the imported function
    // This avoids issues with module loading and Chrome storage async behavior
    const promptText = `
      Create 1 high-quality flashcard based on the following article. Follow these essential guidelines:
      
      • Each card must focus on ONE specific concept (atomic knowledge)
      • Questions should be precise and unambiguous about what they're asking
      • Answers must be EXTREMELY concise - 1-2 sentences maximum (10-25 words)
      • Focus on core concepts, relationships, and techniques rather than trivia
      • Avoid yes/no questions or questions with binary answers
      • When referencing authors, use specific names instead of "the author"
      • Questions should require genuine recall, not just recognition
      
      Consider these knowledge types:
      • For facts: Break complex facts into atomic units
      • For concepts: Address attributes, similarities/differences, and significance
      • For procedures: Focus on decision points and critical parameters
      
      Your output must be in CSV format with each row as: Question,Answer
      Do not include headers or file type information.
      
      Article:
      ${request.content}
    `;
    
    fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: promptText }],
          },
        ],
      }),
    })
    .then(response => response.json())
    .then(data => {
      if (data.error) {
        throw new Error(data.error.message || "API error");
      }
      
      const csvOutput = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!csvOutput) {
        throw new Error("No flashcard content returned");
      }
      
      // Clean up any headers like "Question,Answer"
      const lines = csvOutput.trim().split("\n");
      while (
        lines.length > 0 && 
        lines[0].toLowerCase().includes("question") && 
        lines[0].toLowerCase().includes("answer")
      ) {
        lines.shift();
      }
      
      const cleanedCsv = lines.join("\n");
      console.log("Flashcards generated successfully:", cleanedCsv);
      
      // Create a data URL with the CSV content
      // Use encodeURIComponent to handle special characters properly
      const dataUrl = 'data:text/csv;charset=utf-8,' + encodeURIComponent(cleanedCsv);
      
      // Download the file using the data URL
      chrome.downloads.download({
        url: dataUrl,
        filename: `${request.title.replace(/[^\w\s]/gi, "")}_flashcards.csv`,
        saveAs: false // Don't prompt user where to save
      }, downloadId => {
        if (chrome.runtime.lastError) {
          console.error("Download failed:", chrome.runtime.lastError);
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
        } else {
          console.log("Download initiated with ID:", downloadId);
          sendResponse({ success: true });
        }
      });
    })
    .catch(error => {
      console.error("Error generating flashcards:", error);
      sendResponse({ success: false, error: error.message || "Failed to generate flashcards" });
    });
    
    return true; // Keep the message channel open for async response
  }
});