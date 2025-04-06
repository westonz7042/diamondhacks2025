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

  // Styling
  const checkbox = document.getElementById("show-key");
  checkbox.addEventListener("click", (event) => {
    document.getElementById("api-key").type = checkbox.checked
      ? "text"
      : "password";
  });
});

async function extractContent() {
  try {
    // Show loading state
    const resultElement = document.getElementById("result");
    resultElement.innerHTML =
      '<div class="load-div"> <div class="loader"></div> <div>Extracting and cleaning content...</div> </div>';

    // Get the active tab
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    // Get API key from input
    const apiKey = document.getElementById("api-key").value.trim();

    // Send message to the background script to handle content extraction
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
            const blob = new Blob([flashcards], { type: "text/csv" });
            const url = URL.createObjectURL(blob);
            const downloadLink = document.createElement("a");
            const sanitizedTitle = response.title
              ? response.title.replace(/[^\w\s]/gi, "")
              : "flashcards";
            downloadLink.download = `${sanitizedTitle}_flashcards.csv`;
            downloadLink.href = url;
            downloadLink.textContent = "Download Flashcards as CSV";
            downloadLink.style.display = "block";
            downloadLink.style.marginTop = "10px";
            // Display the extracted content
            resultElement.innerHTML = `
                <h4>${response.title || "Extracted Content"}</h4>
                <div>${flashcards}</div>`;
            resultElement.appendChild(downloadLink);
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
