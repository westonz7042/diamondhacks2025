// background.js

// We get the API key from storage now
let API_KEY = "";

// Function to create the endpoint URL with the latest API key
function getEndpoint() {
  return `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;
}

// URL utility functions
function getHostnameFromUrl(url) {
  if (!url) return 'unknown';
  
  try {
    // Handle invalid or special URLs gracefully
    if (url.startsWith('file://')) return 'local-file';
    if (url.startsWith('chrome://')) return 'chrome-internal';
    if (url.startsWith('chrome-extension://')) return 'extension';
    
    // Parse the URL and extract the hostname
    const hostname = new URL(url).hostname;
    return hostname || 'unknown';
  } catch (error) {
    console.error('Error parsing URL:', error);
    return 'unknown';
  }
}

// Initialize storage structure on installation
chrome.runtime.onInstalled.addListener(() => {
  console.log("Extension installed");
  
  // Initialize saved highlights storage and migrate if needed
  chrome.storage.local.get(['savedHighlights'], function(result) {
    if (!result.savedHighlights) {
      // If no saved highlights exist, create the new structure
      chrome.storage.local.set({ savedHighlights: {} });
    } else if (Array.isArray(result.savedHighlights)) {
      // Migration: Convert from array to website-based object
      console.log("Migrating existing highlights to website-based storage...");
      migrateHighlightsToWebsiteBased(result.savedHighlights);
    }
  });
});

// Function to migrate from flat array to website-based object
function migrateHighlightsToWebsiteBased(oldHighlights) {
  // Create a new object structure
  const newHighlights = {};
  
  // Process each highlight and organize by website
  oldHighlights.forEach(highlight => {
    const hostname = getHostnameFromUrl(highlight.url);
    
    // Initialize the array for this website if it doesn't exist
    if (!newHighlights[hostname]) {
      newHighlights[hostname] = [];
    }
    
    // Add the highlight to the website's array
    newHighlights[hostname].push(highlight);
  });
  
  // Save the new structure
  chrome.storage.local.set({ savedHighlights: newHighlights }, function() {
    console.log("Migration complete. Highlights organized by website.");
    
    // Update badge with total count
    const totalCount = Object.values(newHighlights)
      .reduce((sum, highlights) => sum + highlights.length, 0);
    updateHighlightBadge(totalCount);
  });
}

// Functions to manage saved highlights
function getSavedHighlights(websiteUrl) {
  return new Promise((resolve) => {
    chrome.storage.local.get(['savedHighlights'], function(result) {
      const savedHighlights = result.savedHighlights || {};
      
      if (websiteUrl) {
        // If a specific website is requested, return only those highlights
        const hostname = getHostnameFromUrl(websiteUrl);
        resolve(savedHighlights[hostname] || []);
      } else {
        // If no website specified, return all highlights
        // For backward compatibility, we also provide a flat array
        const allHighlights = Object.values(savedHighlights)
          .reduce((all, siteHighlights) => all.concat(siteHighlights), []);
        
        // Return both formats for flexibility
        resolve({
          byWebsite: savedHighlights,
          allHighlights: allHighlights
        });
      }
    });
  });
}

function saveHighlight(highlight) {
  return new Promise((resolve) => {
    chrome.storage.local.get(['savedHighlights'], function(result) {
      const savedHighlights = result.savedHighlights || {};
      const hostname = getHostnameFromUrl(highlight.url);
      
      // Initialize this website's array if it doesn't exist
      if (!savedHighlights[hostname]) {
        savedHighlights[hostname] = [];
      }
      
      // Add the new highlight with ID and timestamp
      savedHighlights[hostname].push({
        ...highlight,
        id: Date.now(), // Use timestamp as unique ID
        timestamp: new Date().toISOString()
      });
      
      // Save the updated structure
      chrome.storage.local.set({ savedHighlights }, function() {
        // Only show count for the current website in the badge
        const currentSiteCount = savedHighlights[hostname].length;
        
        // Update badge with just this site's count
        updateHighlightBadge(currentSiteCount);
        
        // For convenience, also return all highlights for this website
        resolve({
          websiteHighlights: savedHighlights[hostname],
          totalCount: currentSiteCount
        });
      });
    });
  });
}

function removeHighlight(highlightId) {
  return new Promise((resolve) => {
    chrome.storage.local.get(['savedHighlights'], function(result) {
      const savedHighlights = result.savedHighlights || {};
      let foundAndRemoved = false;
      let affectedHostname = null;
      
      // Search through all websites to find and remove the highlight
      for (const hostname in savedHighlights) {
        const siteHighlights = savedHighlights[hostname];
        const initialLength = siteHighlights.length;
        
        // Filter out the highlight with matching ID
        savedHighlights[hostname] = siteHighlights.filter(h => h.id !== highlightId);
        
        // If length changed, we found and removed it
        if (savedHighlights[hostname].length < initialLength) {
          foundAndRemoved = true;
          affectedHostname = hostname;
        }
      }
      
      // Save the updated structure
      chrome.storage.local.set({ savedHighlights }, function() {
        // Get active tab to update the badge appropriately
        chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
          if (tabs.length > 0 && tabs[0].url) {
            const currentHostname = getHostnameFromUrl(tabs[0].url);
            
            // Update badge to show count for current site
            const currentSiteHighlights = savedHighlights[currentHostname] || [];
            updateHighlightBadge(currentSiteHighlights.length);
          }
          
          // Return the updated highlights structure
          resolve({
            byWebsite: savedHighlights,
            success: foundAndRemoved
          });
        });
      });
    });
  });
}

function clearAllHighlights(websiteUrl) {
  return new Promise((resolve) => {
    // If a specific website is provided, only clear that website's highlights
    if (websiteUrl) {
      chrome.storage.local.get(['savedHighlights'], function(result) {
        const savedHighlights = result.savedHighlights || {};
        const hostname = getHostnameFromUrl(websiteUrl);
        
        // Clear just this website's highlights
        if (savedHighlights[hostname]) {
          delete savedHighlights[hostname];
          
          // Save the updated structure
          chrome.storage.local.set({ savedHighlights }, function() {
            // Clear badge (no highlights for this site)
            chrome.action.setBadgeText({ text: '' });
            resolve({ success: true, totalCount: 0 });
          });
        } else {
          // No highlights for this website
          resolve({ success: true, totalCount: 0 });
        }
      });
    } else {
      // If no website specified, this is a legacy call from older versions
      // We'll keep it for backward compatibility but it's not used in the new UI
      chrome.storage.local.set({ savedHighlights: {} }, function() {
        // Remove badge
        chrome.action.setBadgeText({ text: '' });
        resolve({ success: true, totalCount: 0 });
      });
    }
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

// Initialize badge on startup for active tab
chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
  if (tabs.length > 0 && tabs[0].url) {
    const hostname = getHostnameFromUrl(tabs[0].url);
    
    chrome.storage.local.get(['savedHighlights'], function(result) {
      const savedHighlights = result.savedHighlights || {};
      const siteHighlights = savedHighlights[hostname] || [];
      
      updateHighlightBadge(siteHighlights.length);
    });
  }
});

// Update badge when tabs change
chrome.tabs.onActivated.addListener(function(activeInfo) {
  chrome.tabs.get(activeInfo.tabId, function(tab) {
    if (tab && tab.url) {
      const hostname = getHostnameFromUrl(tab.url);
      
      chrome.storage.local.get(['savedHighlights'], function(result) {
        const savedHighlights = result.savedHighlights || {};
        const siteHighlights = savedHighlights[hostname] || [];
        
        updateHighlightBadge(siteHighlights.length);
      });
    }
  });
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
  // Check if the extension context is still valid
  if (chrome.runtime.id === undefined) {
    console.error("Extension context invalidated");
    return;
  }
  
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
      // Check again if extension context is still valid
      if (chrome.runtime.id === undefined) {
        console.error("Extension context invalidated during script execution");
        return;
      }
      
      // Now that the content script is injected, send a message to it
      chrome.tabs.sendMessage(request.tabId, { 
        action: "extractContent",
        apiKey: request.apiKey 
      }, async (response) => {
        // Check for runtime.lastError
        if (chrome.runtime.lastError) {
          console.error("Error sending message:", chrome.runtime.lastError);
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
          return;
        }
        
        console.log("Got response from content script:", response);
        
        if (response && response.success) {
          try {
            // Clean up the extracted text
            console.log("Cleaning up extracted text...");
            cleanupTextWithAPI(response.content, request.apiKey)
              .then(cleanedResponse => {
                // Check if extension context is still valid
                if (chrome.runtime.id === undefined) {
                  console.error("Extension context invalidated during API call");
                  return;
                }
                
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
    // Check if we're requesting highlights for a specific website
    const websiteUrl = request.websiteUrl || null;
    
    getSavedHighlights(websiteUrl).then(highlights => {
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
    clearAllHighlights(request.websiteUrl).then((result) => {
      sendResponse({ success: true, totalCount: result.totalCount });
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