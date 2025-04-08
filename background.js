// background.js
import { callModel } from "./modelcall.js";

// URL utility functions
function getHostnameFromUrl(url) {
  if (!url) {
    console.warn("Empty URL passed to getHostnameFromUrl");
    return "unknown";
  }

  try {
    // Handle invalid or special URLs gracefully
    if (url.startsWith("file://")) {
      console.log("Processing file:// URL:", url);
      return "local-file";
    }
    if (url.startsWith("chrome://")) {
      console.log("Processing chrome:// URL:", url);
      return "chrome-internal";
    }
    if (url.startsWith("chrome-extension://")) {
      console.log("Processing chrome-extension:// URL:", url);
      return "extension";
    }

    // Parse the URL and extract the hostname and pathname
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    const pathname = urlObj.pathname;
    
    // Combine hostname and pathname (excluding trailing slashes) to create a unique page identifier
    // This ensures different pages on the same domain have different keys
    const result = hostname + pathname.replace(/\/$/, "") || "unknown";
    console.log(`URL processed: ${url} → ${result}`);
    return result;
  } catch (error) {
    console.error("Error parsing URL:", error, "URL was:", url);
    return "unknown";
  }
}

// Initialize storage structure on installation
chrome.runtime.onInstalled.addListener(() => {
  console.log("Extension installed");

  // Initialize saved highlights storage and migrate if needed
  chrome.storage.local.get(["savedHighlights"], function (result) {
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
  oldHighlights.forEach((highlight) => {
    const hostname = getHostnameFromUrl(highlight.url);

    // Initialize the array for this website if it doesn't exist
    if (!newHighlights[hostname]) {
      newHighlights[hostname] = [];
    }

    // Add the highlight to the website's array
    newHighlights[hostname].push(highlight);
  });

  // Save the new structure
  chrome.storage.local.set({ savedHighlights: newHighlights }, function () {
    console.log("Migration complete. Highlights organized by website.");

    // Update badge with total count
    const totalCount = Object.values(newHighlights).reduce(
      (sum, highlights) => sum + highlights.length,
      0
    );
    updateHighlightBadge(totalCount);
  });
}

// Functions to manage saved highlights
function getSavedHighlights(websiteUrl) {
  return new Promise((resolve) => {
    chrome.storage.local.get(["savedHighlights"], function (result) {
      const savedHighlights = result.savedHighlights || {};

      if (websiteUrl) {
        // If a specific website is requested, return only those highlights
        const hostname = getHostnameFromUrl(websiteUrl);
        resolve(savedHighlights[hostname] || []);
      } else {
        // If no website specified, return all highlights
        // For backward compatibility, we also provide a flat array
        const allHighlights = Object.values(savedHighlights).reduce(
          (all, siteHighlights) => all.concat(siteHighlights),
          []
        );

        // Return both formats for flexibility
        resolve({
          byWebsite: savedHighlights,
          allHighlights: allHighlights,
        });
      }
    });
  });
}

function saveHighlight(highlight) {
  return new Promise((resolve) => {
    chrome.storage.local.get(["savedHighlights"], function (result) {
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
        timestamp: new Date().toISOString(),
      });

      // Save the updated structure
      chrome.storage.local.set({ savedHighlights }, function () {
        // Only show count for the current website in the badge
        const currentSiteCount = savedHighlights[hostname].length;

        // Update badge with just this site's count
        updateHighlightBadge(currentSiteCount);

        // For convenience, also return all highlights for this website
        resolve({
          websiteHighlights: savedHighlights[hostname],
          totalCount: currentSiteCount,
        });
      });
    });
  });
}

function removeHighlight(highlightId) {
  return new Promise((resolve) => {
    chrome.storage.local.get(["savedHighlights"], function (result) {
      const savedHighlights = result.savedHighlights || {};
      let foundAndRemoved = false;
      let affectedHostname = null;

      // Search through all websites to find and remove the highlight
      for (const hostname in savedHighlights) {
        const siteHighlights = savedHighlights[hostname];
        const initialLength = siteHighlights.length;

        // Filter out the highlight with matching ID
        savedHighlights[hostname] = siteHighlights.filter(
          (h) => h.id !== highlightId
        );

        // If length changed, we found and removed it
        if (savedHighlights[hostname].length < initialLength) {
          foundAndRemoved = true;
          affectedHostname = hostname;
        }
      }

      // Save the updated structure
      chrome.storage.local.set({ savedHighlights }, function () {
        // Get active tab to update the badge appropriately
        chrome.tabs.query(
          { active: true, currentWindow: true },
          function (tabs) {
            if (tabs.length > 0 && tabs[0].url) {
              const currentHostname = getHostnameFromUrl(tabs[0].url);

              // Update badge to show count for current site
              const currentSiteHighlights =
                savedHighlights[currentHostname] || [];
              updateHighlightBadge(currentSiteHighlights.length);
            }

            // Return the updated highlights structure
            resolve({
              byWebsite: savedHighlights,
              success: foundAndRemoved,
            });
          }
        );
      });
    });
  });
}

function clearAllHighlights(websiteUrl) {
  return new Promise((resolve) => {
    // If a specific website is provided, only clear that website's highlights
    if (websiteUrl) {
      console.log("Clearing highlights for website:", websiteUrl);
      chrome.storage.local.get(["savedHighlights"], function (result) {
        const savedHighlights = result.savedHighlights || {};
        const hostname = getHostnameFromUrl(websiteUrl);
        console.log("Generated hostname for clearing:", hostname);

        // Clear just this website's highlights
        if (savedHighlights[hostname]) {
          console.log("Found highlights to clear for hostname:", hostname);
          delete savedHighlights[hostname];

          // Save the updated structure
          chrome.storage.local.set({ savedHighlights }, function () {
            console.log("Cleared highlights for:", hostname);
            
            // Update badge based on active tab after clearing
            chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
              if (tabs.length > 0 && tabs[0].url) {
                const currentHostname = getHostnameFromUrl(tabs[0].url);
                console.log("Active tab hostname:", currentHostname);
                
                // Get count for current active tab
                const currentTabHighlights = savedHighlights[currentHostname] || [];
                updateHighlightBadge(currentTabHighlights.length);
                console.log("Updated badge count for active tab:", currentTabHighlights.length);
              } else {
                // If no active tab, just clear the badge
                chrome.action.setBadgeText({ text: "" });
              }
              
              resolve({ success: true, totalCount: 0 });
            });
          });
        } else {
          console.log("No highlights found for hostname:", hostname);
          // No highlights for this website, but still update badge for active tab
          chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            if (tabs.length > 0 && tabs[0].url) {
              const currentHostname = getHostnameFromUrl(tabs[0].url);
              const currentTabHighlights = savedHighlights[currentHostname] || [];
              updateHighlightBadge(currentTabHighlights.length);
            } else {
              chrome.action.setBadgeText({ text: "" });
            }
            
            resolve({ success: true, totalCount: 0 });
          });
        }
      });
    } else {
      // If no website specified, this is a legacy call from older versions
      // We'll keep it for backward compatibility but it's not used in the new UI
      chrome.storage.local.set({ savedHighlights: {} }, function () {
        // Remove badge for all tabs
        chrome.action.setBadgeText({ text: "" });
        resolve({ success: true, totalCount: 0 });
      });
    }
  });
}

// Update the extension badge to show number of saved highlights
function updateHighlightBadge(count) {
  if (count > 0) {
    chrome.action.setBadgeText({ text: count.toString() });
    chrome.action.setBadgeBackgroundColor({ color: "#4285f4" });
  } else {
    chrome.action.setBadgeText({ text: "" });
  }
}

// Initialize badge on startup for active tab
chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
  if (tabs.length > 0 && tabs[0].url) {
    const hostname = getHostnameFromUrl(tabs[0].url);

    chrome.storage.local.get(["savedHighlights"], function (result) {
      const savedHighlights = result.savedHighlights || {};
      const siteHighlights = savedHighlights[hostname] || [];

      updateHighlightBadge(siteHighlights.length);
    });
  }
});

// Update badge when tabs change
chrome.tabs.onActivated.addListener(function (activeInfo) {
  chrome.tabs.get(activeInfo.tabId, function (tab) {
    if (tab && tab.url) {
      const hostname = getHostnameFromUrl(tab.url);

      chrome.storage.local.get(["savedHighlights"], function (result) {
        const savedHighlights = result.savedHighlights || {};
        const siteHighlights = savedHighlights[hostname] || [];

        updateHighlightBadge(siteHighlights.length);
      });
    }
  });
});

const pdfStatus = {}; // key: tabId, value: true/false

// Function to clean up text using Gemini API
async function cleanupTextWithAPI(text, apiKey) {
  const prompt = `Extract and clean the content from this webpage text. Keep the important information including title, main body, and key points. Remove navigation elements, ads, footers, and other non-essential content:\n\n${text}`;

  try {
    const response = await callModel(prompt, apiKey);
    if (!response.success) {
      return { error: response.error, success: false };
    }

    console.log("✨ Text cleaned successfully");
    return { content: response.content, success: true };
  } catch (error) {
    console.error("Text cleanup request failed:", error);
    return { error: error.message, success: false };
  }
}

// This listener will be called when the popup requests content extraction or when selection-based generation is requested
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Check if the extension context is still valid
  if (chrome.runtime.id === undefined) {
    console.error("Extension context invalidated");
    return;
  }

  if (request.action === "getPDFStatus") {
    console.log(pdfStatus);
    sendResponse({ success: true, isPDF: pdfStatus[request.tabId] });
    console.log("PDF Status requested");
  } else if (request.action === "extract") {
    console.log("Extraction requested for tab:", request.tabId);

    // Store API key for use by other parts of the extension
    if (request.apiKey) {
      chrome.storage.sync.set({ apiKey: request.apiKey });
    }

    // Execute content script
    chrome.scripting
      .executeScript({
        target: { tabId: request.tabId },
        files: ["libs/readability.js", "content.js"],
      })
      .then(() => {
        // Check again if extension context is still valid
        if (chrome.runtime.id === undefined) {
          console.error(
            "Extension context invalidated during script execution"
          );
          return;
        }
        // Now that the content script is injected, send a message to it
        chrome.tabs.sendMessage(
          request.tabId,
          {
            action: "extractContent",
            apiKey: request.apiKey,
            isPDF: request.isPDF,
          },
          async (response) => {
            // Check for runtime.lastError
            if (chrome.runtime.lastError) {
              console.error("Error sending message:", chrome.runtime.lastError);
              sendResponse({
                success: false,
                error: chrome.runtime.lastError.message,
              });
              return;
            }
            console.log("Got response from content script:", response);

            if (response && response.success) {
              try {
                // Clean up the extracted text
                console.log("Cleaning up extracted text...");
                const cleanedResponse = await cleanupTextWithAPI(
                  response.content,
                  request.apiKey
                );

                if (cleanedResponse.success) {
                  // Return the cleaned text
                  sendResponse({
                    title: response.title,
                    content: cleanedResponse.content,
                    success: true,
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
          }
        );
      })
      .catch((error) => {
        console.error("Error injecting content script:", error);
        sendResponse({ success: false, error: error.message });
      });

    return true; // Keep the message channel open for async response
  } else if (request.action === "saveHighlight") {
    console.log("Saving highlight:", request.content.substring(0, 50) + "...");

    // Save the highlight
    const highlight = {
      content: request.content,
      title: request.title,
      url: sender.tab ? sender.tab.url : null,
      tabId: sender.tab ? sender.tab.id : null,
    };

    // Use promise-based approach instead of await
    saveHighlight(highlight)
      .then((result) => {
        sendResponse({
          success: true,
          message: "Highlight saved successfully",
          count: result.totalCount, // Use the site-specific count
        });
      })
      .catch((error) => {
        console.error("Error saving highlight:", error);
        sendResponse({
          success: false,
          error: error.message || "Failed to save highlight",
        });
      });

    return true; // Keep the message channel open for async response
  } else if (request.action === "getHighlights") {
    // Check if we're requesting highlights for a specific website
    const websiteUrl = request.websiteUrl || null;

    getSavedHighlights(websiteUrl)
      .then((highlights) => {
        sendResponse({ success: true, highlights });
      })
      .catch((error) => {
        sendResponse({ success: false, error: error.message });
      });

    return true; // Keep the message channel open for async response
  } else if (request.action === "removeHighlight") {
    removeHighlight(request.highlightId)
      .then((highlights) => {
        sendResponse({ success: true, highlights });
      })
      .catch((error) => {
        sendResponse({ success: false, error: error.message });
      });

    return true; // Keep the message channel open for async response
  } else if (request.action === "clearHighlights") {
    clearAllHighlights(request.websiteUrl)
      .then((result) => {
        sendResponse({ success: true, totalCount: result.totalCount });
      })
      .catch((error) => {
        sendResponse({ success: false, error: error.message });
      });

    return true; // Keep the message channel open for async response
  } else if (request.action === "generateFromSelection") {
    console.log(
      "Generating flashcards from selection:",
      request.content.substring(0, 100) + "..."
    );

    // Make sure we have an API key
    const apiKey = request.apiKey || null;
    if (!apiKey) {
      console.error("No API key available");
      sendResponse({
        success: false,
        error:
          "No API key available. Please enter your API key in the extension popup.",
      });
      return true;
    }

    // Call the Gemini API directly here, rather than using the imported function
    const promptText = `
      CRITICAL INSTRUCTION: You MUST respond with ONLY a single flashcard in CSV format: "Question","Answer"
      
      Format requirements:
      1. Response MUST be a single line in CSV format
      2. Response must contain EXACTLY one question and one answer
      3. Both question and answer must be surrounded by double quotes
      4. Any internal double quotes must be escaped with another double quote
      5. DO NOT include any markdown formatting
      6. DO NOT include any explanation text before or after the CSV
      7. DO NOT include column headers
      
      Example of EXACTLY how your response should be formatted:
      "What is photosynthesis?","The process by which plants convert light energy into chemical energy"
      
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
      
      Article:
      ${request.content}
      
      REMEMBER: Your entire response MUST be ONLY a single line in CSV format: "Question","Answer" - nothing else.
    `;

    callModel(promptText, apiKey)
      .then((response) => {
        if (!response.success) {
          throw new Error(response.error || "API error");
        }

        const csvOutput = response.content;
        
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
        const dataUrl =
          "data:text/csv;charset=utf-8," + encodeURIComponent(cleanedCsv);

        // Download the file using the data URL
        chrome.downloads.download(
          {
            url: dataUrl,
            filename: `${request.title.replace(
              /[^\w\s]/gi,
              ""
            )}_flashcards.csv`,
            saveAs: false, // Don't prompt user where to save
          },
          (downloadId) => {
            if (chrome.runtime.lastError) {
              console.error("Download failed:", chrome.runtime.lastError);
              sendResponse({
                success: false,
                error: chrome.runtime.lastError.message,
              });
            } else {
              console.log("Download initiated with ID:", downloadId);
              sendResponse({ success: true });
            }
          }
        );
      })
      .catch((error) => {
        console.error("Error generating flashcards:", error);
        sendResponse({
          success: false,
          error: error.message || "Failed to generate flashcards",
        });
      });

    return true; // Keep the message channel open for async response
  }
});

// Check for PDF
// Declare the rule for intercepting requests and checking for PDF
chrome.webRequest.onHeadersReceived.addListener(
  (details) => {
    const isPDF = details.responseHeaders.some(
      (header) =>
        header.name.toLowerCase() === "content-type" &&
        header.value.toLowerCase().includes("application/pdf")
    );

    pdfStatus[details.tabId] = isPDF;
    console.log(`Tab ${details.tabId} is PDF: ${isPDF}`);
  },
  { urls: ["<all_urls>"], types: ["main_frame"] },
  ["responseHeaders"]
);

// Cleanup on tab close
chrome.tabs.onRemoved.addListener((tabId) => {
  delete pdfStatus[tabId];
});