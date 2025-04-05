// popup.js

import { generateFlashcards } from "./flashcard.js";

document.addEventListener("DOMContentLoaded", () => {
  // Load saved API key if exists
  chrome.storage.sync.get(['apiKey'], function(result) {
    if (result.apiKey) {
      document.getElementById("api-key").value = result.apiKey;
    }
  });
  
  // Save API key when it changes
  document.getElementById("api-key").addEventListener("change", function() {
    const apiKey = document.getElementById("api-key").value.trim();
    chrome.storage.sync.set({apiKey: apiKey});
  });
  
  document.getElementById("extract").addEventListener("click", extractContent);
});

async function extractContent() {
  try {
    // Show loading state
    const resultElement = document.getElementById('result');
    resultElement.innerHTML = '<p>Extracting and cleaning content...</p>';
    
    // Get the active tab
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    // Get API key from input
    const apiKey = document.getElementById("api-key").value.trim();
    
    // Send message to the background script to handle content extraction and cleanup
    chrome.runtime.sendMessage(
      { action: "extract", tabId: tab.id, apiKey: apiKey },
      (response) => {
        if (chrome.runtime.lastError) {
          resultElement.innerHTML = `<p>Error: ${chrome.runtime.lastError.message}</p>`;
          return;
        }

        if (!response || !response.success) {
          resultElement.innerHTML = `<p>Extraction failed: ${
            response?.error || "Unknown error"
          }</p>`;
          return;
        }
        
        // Generate flashcards from the cleaned content
        generateFlashcards(response.content)
          .then((flashcards) => {
            // Display the flashcards
            resultElement.innerHTML = `
              <h4>${response.title || "Extracted Content"}</h4>
              <div>${flashcards}</div>`;
          })
          .catch((error) => {
            console.log(error);
            resultElement.innerHTML = `<p>Error generating flashcards: ${error}</p>`;
          });
        
        // Print cleaned content to console instead of copying to clipboard
        console.log("Cleaned content:", response.content);
      }
    );
  } catch (error) {
    console.error("Error in popup script:", error);
    document.getElementById(
      "result"
    ).innerHTML = `<p>Error: ${error.message}</p>`;
  }
}
