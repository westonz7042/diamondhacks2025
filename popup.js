// popup.js

import { generateFlashcards } from "./flashcard.js";

document.addEventListener("DOMContentLoaded", () => {
  // Load saved API key if exists
  chrome.storage.sync.get(["apiKey"], function (result) {
    if (result.apiKey) {
      document.getElementById("api-key").value = result.apiKey;
    }
  });

  // Save API key when it changes
  document.getElementById("api-key").addEventListener("change", function () {
    const apiKey = document.getElementById("api-key").value.trim();
    chrome.storage.sync.set({ apiKey: apiKey });
  });

  document.getElementById("extract").addEventListener("click", extractContent);

  document.getElementById("pref").addEventListener("change", function () {
    const pref = document.getElementById("pref").value.trim();
    chrome.storage.sync.set({ pref: pref });
  });

  document.getElementById("num-cards").addEventListener("change", function () {
    const pref = document.getElementById("num-cards").value.trim();
    chrome.storage.sync.set({ numCards: numCards });
  });
});

async function extractContent() {
  try {
    // Show loading state
    const resultElement = document.getElementById("result");
    resultElement.innerHTML = "<p>Extracting content...</p>";

    // Get the active tab
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    // Get API key from input
    const apiKey = document.getElementById("api-key").value.trim();
    const pref = document.getElementById("pref").value.trim();
    const numCards = document.getElementById("num-cards").value.trim();

    // Send message to the background script to handle content extraction
    chrome.runtime.sendMessage(
      {
        action: "extract",
        tabId: tab.id,
        apiKey: apiKey,
        pref: pref,
        numCards: numCards,
      },
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

        generateFlashcards(response.content, pref, numCards)
          .then((flashcards) => {
            // Display the extracted content
            resultElement.innerHTML = `
                <h4>${response.title || "Extracted Content"}</h4>
                <div>${flashcards}</div>`;
          })
          .catch((error) => {
            console.log(error);
            resultElement.innerHTML = `<p>Error generating flashcards: ${error}</p>`;
          });

        // Save to clipboard
        navigator.clipboard.writeText(response.content).catch((err) => {
          console.error("Could not copy text: ", err);
        });
      }
    );
  } catch (error) {
    console.error("Error in popup script:", error);
    document.getElementById(
      "result"
    ).innerHTML = `<p>Error: ${error.message}</p>`;
  }
}
