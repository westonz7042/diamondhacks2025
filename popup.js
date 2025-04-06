// popup.js
const style = document.createElement("style");
style.textContent = `
  .flashcard-container {
    perspective: 1000px;
  }
  .flashcard {
    width: 100%;
    max-width: 300px;
    height: 150px;
    margin: 0 auto 10px;
    position: relative;
    transition: transform 0.6s;
    transform-style: preserve-3d;
    cursor: pointer;
  }
  .flashcard.flipped {
    transform: rotateX(180deg);
  }
  .flashcard-face {
    position: absolute;
    width: 100%;
    height: 100%;
    backface-visibility: hidden;
    background: #f9f9f9;
    border: 1px solid #888;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    box-sizing: border-box;
  }
  .flashcard-face.back {
    transform: rotateX(-180deg);
    background: #e9f9ff;
  }
  .flashcard-controls {
    display: flex;
    justify-content: space-between;
  }
`;
document.head.appendChild(style);

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

  // prompts
  document.getElementById("pref").addEventListener("change", function () {
    const pref = document.getElementById("pref").value.trim();
    chrome.storage.sync.set({ pref: pref });
  });

  // Styling
  const checkbox = document.getElementById("show-key");
  checkbox.addEventListener("click", (event) => {
    document.getElementById("api-key").type = checkbox.checked
      ? "text"
      : "password";
  });

  // Load preferences from storage
  chrome.storage.sync.get(["pref"], function (result) {
    if (result.pref) {
      document.getElementById("pref").value = result.pref;
    }
  });

  // Load saved highlights and display them
  loadSavedHighlights();

  // Add event listeners for the highlights section
  document.getElementById("extract").addEventListener("click", extractContent);
  document
    .getElementById("clear-highlights")
    .addEventListener("click", clearAllHighlights);
  document
    .getElementById("generate-from-highlights")
    .addEventListener("click", generateFromHighlights);
});

// Function to load and display saved highlights
function loadSavedHighlights() {
  chrome.runtime.sendMessage({ action: "getHighlights" }, function (response) {
    if (response && response.success && response.highlights) {
      displayHighlights(response.highlights);
    } else {
      console.error(
        "Failed to load highlights:",
        response?.error || "Unknown error"
      );
    }
  });
}

// Function to display highlights in the popup
function displayHighlights(highlights) {
  const highlightsSection = document.getElementById("saved-highlights-section");
  const highlightsList = document.getElementById("highlights-list");

  // Clear existing content
  highlightsList.innerHTML = "";

  // Check if we have any highlights
  if (highlights && highlights.length > 0) {
    // Show the highlights section
    highlightsSection.style.display = "block";

    // Add each highlight to the list
    highlights.forEach((highlight) => {
      const highlightItem = document.createElement("div");
      highlightItem.className = "highlight-item";
      highlightItem.style.padding = "8px";
      highlightItem.style.marginBottom = "8px";
      highlightItem.style.border = "1px solid #ddd";
      highlightItem.style.borderRadius = "4px";
      highlightItem.style.backgroundColor = "#f5f5f5";
      highlightItem.style.position = "relative";

      // Create text content with truncation if needed
      const contentText =
        highlight.content.length > 100
          ? highlight.content.substring(0, 100) + "..."
          : highlight.content;

      highlightItem.innerHTML = `
        <div style="margin-right: 20px;">${contentText}</div>
        <button class="remove-highlight" data-id="${highlight.id}" style="
          position: absolute;
          top: 5px;
          right: 5px;
          background: none;
          border: none;
          color: #666;
          cursor: pointer;
          font-size: 14px;
          padding: 0;
          width: auto;">×</button>
      `;

      // Add click handler for remove button
      const removeButton = highlightItem.querySelector(".remove-highlight");
      removeButton.addEventListener("click", function (e) {
        e.stopPropagation();
        removeHighlight(highlight.id);
      });

      highlightsList.appendChild(highlightItem);
    });
  } else {
    // Hide the section if no highlights
    highlightsSection.style.display = "none";
  }
}

// Function to remove a highlight
function removeHighlight(highlightId) {
  chrome.runtime.sendMessage(
    {
      action: "removeHighlight",
      highlightId: highlightId,
    },
    function (response) {
      if (response && response.success) {
        displayHighlights(response.highlights);
      } else {
        console.error(
          "Failed to remove highlight:",
          response?.error || "Unknown error"
        );
      }
    }
  );
}

// Function to clear all highlights
function clearAllHighlights() {
  if (confirm("Are you sure you want to clear all saved highlights?")) {
    chrome.runtime.sendMessage(
      { action: "clearHighlights" },
      function (response) {
        if (response && response.success) {
          document.getElementById("saved-highlights-section").style.display =
            "none";
        } else {
          console.error(
            "Failed to clear highlights:",
            response?.error || "Unknown error"
          );
        }
      }
    );
  }
}

// Function to generate flashcards from the saved highlights
async function generateFromHighlights() {
  try {
    // Show loading state
    const resultElement = document.getElementById("result");
    resultElement.style.display = "flex";
    resultElement.innerHTML = "<p>Generating flashcards from highlights...</p>";

    // Get the active tab
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    // Get API key from input
    const apiKey = document.getElementById("api-key").value.trim();

    if (!apiKey) {
      resultElement.innerHTML = "<p>Error: Please enter your API key</p>";
      return;
    }

    // Get user preferences
    const pref = document.getElementById("pref").value.trim();

    // Get saved highlights
    chrome.runtime.sendMessage(
      { action: "getHighlights" },
      function (response) {
        if (!response || !response.success) {
          resultElement.innerHTML = `<p>Error retrieving highlights: ${
            response?.error || "Unknown error"
          }</p>`;
          return;
        }

        const highlights = response.highlights || [];

        if (highlights.length === 0) {
          resultElement.innerHTML =
            "<p>No highlights found. Please highlight text on webpages first.</p>";
          return;
        }

        // Extract the full article for context and generate cards
        chrome.tabs.sendMessage(
          tab.id,
          {
            action: "extractContent",
            apiKey: apiKey,
          },
          async (extractResponse) => {
            try {
              // Get the article content if available, or just use highlights
              const fullArticle =
                extractResponse && extractResponse.success
                  ? extractResponse.content
                  : "";

              // Create a prompt with the highlighted text (and article if available)
              const highlightTexts = highlights
                .map((h) => h.content)
                .join("\n\n---\n\n");

              let specialPrompt;
              if (fullArticle) {
                // Use full article as context if available
                specialPrompt = `
            For this task, I'm providing you with HIGHLIGHTED TEXT passages from an article.
            Generate one high-quality flashcards focusing SPECIFICALLY on the highlighted passages.
            Use the full article for context to create better cards.
            
            ${pref ? `User preferences: ${pref}` : ""}
            
            HIGHLIGHTED PASSAGES (create cards for these specifically):
            ${highlightTexts}
            
            FULL ARTICLE (for context):
            ${fullArticle}
            `;
              } else {
                // Just use highlights if no article context
                specialPrompt = `
            Generate one high-quality flashcard based on each of these excerpts:
            
            ${pref ? `User preferences: ${pref}` : ""}
            
            Text:
            ${highlightTexts}
            `;
              }

              // Generate the flashcards from the data
              const flashcardsData = await generateFlashcards(
                specialPrompt,
                null
              );

              // Process JSON response
              let jsonArray;
              if (typeof flashcardsData === "string") {
                // Handle string response (could be JSON string)
                let trimmedData = flashcardsData
                  .trim()
                  .replace(/^```|```$/g, "");
                try {
                  jsonArray = JSON.parse(trimmedData);
                } catch (error) {
                  console.error("Failed to parse JSON:", error);
                  resultElement.innerHTML = `<p>Error parsing response: ${error.message}</p>`;
                  return;
                }
              } else if (Array.isArray(flashcardsData)) {
                // Handle direct array response
                jsonArray = flashcardsData;
              } else {
                console.error("Unexpected response format:", flashcardsData);
                resultElement.innerHTML = `<p>Error: Unexpected response format</p>`;
                return;
              }

              // Convert JSON to CSV format
              const csvContent = jsonArray
                .map(({ front, back }) => {
                  const escapedFront = `"${(front || "").replace(/"/g, '""')}"`;
                  const escapedBack = `"${(back || "").replace(/"/g, '""')}"`;
                  return `${escapedFront},${escapedBack}`;
                })
                .join("\n");

              // Display the results
              const blob = new Blob([csvContent], { type: "text/csv" });
              const url = URL.createObjectURL(blob);
              const downloadLink = document.createElement("a");
              const title =
                extractResponse && extractResponse.title
                  ? extractResponse.title.replace(/[^\w\s]/gi, "")
                  : "flashcards_from_highlights";
              downloadLink.download = `${title}_flashcards.csv`;
              downloadLink.href = url;
              downloadLink.textContent = "Download Flashcards as CSV";
              downloadLink.style.display = "block";
              downloadLink.style.marginTop = "10px";

              // Display the extracted content
              resultElement.innerHTML = `
            <h4>${
              (extractResponse && extractResponse.title) ||
              "Flashcards From Highlights"
            }</h4>
          `;
              resultElement.appendChild(downloadLink);
              displayQuizletFlashcards(jsonArray);
            } catch (error) {
              console.error("Error generating flashcards:", error);
              resultElement.innerHTML = `<p>Error generating flashcards: ${error}</p>`;
            }
          }
        );
      }
    );
  } catch (error) {
    console.error("Error in generate from highlights:", error);
    document.getElementById(
      "result"
    ).innerHTML = `<p>Error: ${error.message}</p>`;
  }
}

async function extractContent() {
  try {
    // Show loading state
    const resultElement = document.getElementById("result");

    resultElement.innerHTML = "";
    resultElement.style.display = "none";

    resultElement.innerHTML =
      '<div class="load-div"> <div class="loader"></div> <div>Extracting and cleaning content...</div> </div>';

    resultElement.style.display = "flex";
    // Get the active tab
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    // Get API key from input
    const apiKey = document.getElementById("api-key").value.trim();
    const pref = document.getElementById("pref").value.trim();

    // Send message to the background script to handle content extraction
    chrome.runtime.sendMessage(
      {
        action: "extract",
        tabId: tab.id,
        apiKey: apiKey,
        pref: pref,
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

        // Generate flashcards from the cleaned content

        generateFlashcards(response.content, pref)
          .then((flashcardsData) => {
            // Process the JSON response from generateFlashcards
            let jsonArray;

            if (typeof flashcardsData === "string") {
              // Handle string response (could be JSON string)
              let trimmedData = flashcardsData.trim().replace(/^```|```$/g, "");
              try {
                jsonArray = JSON.parse(trimmedData);
              } catch (error) {
                console.error("Failed to parse JSON:", error);
                resultElement.innerHTML = `<p>Error parsing response: ${error.message}</p>`;
                return;
              }
            } else if (Array.isArray(flashcardsData)) {
              // Handle direct array response
              jsonArray = flashcardsData;
            } else {
              console.error("Unexpected response format:", flashcardsData);
              resultElement.innerHTML = `<p>Error: Unexpected response format</p>`;
              return;
            }

            // Convert JSON to CSV format
            const csvContent = jsonArray
              .map(({ front, back }) => {
                const escapedFront = `"${(front || "").replace(/"/g, '""')}"`;
                const escapedBack = `"${(back || "").replace(/"/g, '""')}"`;
                return `${escapedFront},${escapedBack}`;
              })
              .join("\n");

            // Create download link for CSV
            const blob = new Blob([csvContent], { type: "text/csv" });
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

            resultElement.innerHTML = `
            <h4>${response.title || "Extracted Content"}</h4>`;
            resultElement.appendChild(downloadLink);
            displayQuizletFlashcards(jsonArray);
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
function displayQuizletFlashcards(flashcardsData) {
  let currentIndex = 0;

  // Ensure we have a valid array of flashcard objects
  let flashcardsArray;

  if (typeof flashcardsData === "string") {
    try {
      // Try to parse if it's a JSON string
      let trimmedData = flashcardsData.trim().replace(/^```|```$/g, "");
      flashcardsArray = JSON.parse(trimmedData);
    } catch (error) {
      console.error("Error parsing flashcards data:", error);
      return; // Exit if parsing fails
    }
  } else if (Array.isArray(flashcardsData)) {
    flashcardsArray = flashcardsData;
  } else {
    console.error("Invalid flashcards data format:", flashcardsData);
    return; // Exit if format is invalid
  }

  // Check if array is empty
  if (!flashcardsArray || flashcardsArray.length === 0) {
    console.error("No flashcards to display");
    return;
  }

  const container = document.createElement("div");
  container.id = "quizlet-container";
  container.className = "flashcard-container";

  const card = document.createElement("div");
  card.className = "flashcard";

  const front = document.createElement("div");
  front.className = "flashcard-face front";
  front.textContent = flashcardsArray[currentIndex].front;

  const back = document.createElement("div");
  back.className = "flashcard-face back";
  back.textContent = flashcardsArray[currentIndex].back;

  card.appendChild(front);
  card.appendChild(back);

  card.addEventListener("click", () => {
    card.classList.toggle("flipped");
  });

  const controls = document.createElement("div");
  controls.className = "flashcard-controls";

  const prev = document.createElement("button");
  prev.textContent = "Previous";
  prev.onclick = () => {
    if (currentIndex > 0) {
      currentIndex--;
      updateCard();
    }
  };

  const next = document.createElement("button");
  next.textContent = "Next";
  next.onclick = () => {
    if (currentIndex < flashcardsArray.length - 1) {
      currentIndex++;
      updateCard();
    }
  };

  controls.appendChild(prev);
  controls.appendChild(next);

  container.appendChild(card);
  container.appendChild(controls);
  document.getElementById("result").appendChild(container);

  function updateCard() {
    front.textContent = flashcardsArray[currentIndex].front;
    back.textContent = flashcardsArray[currentIndex].back;
    card.classList.remove("flipped"); // reset to front view
  }
}
