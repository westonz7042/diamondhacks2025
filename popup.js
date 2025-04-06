// popup.js
const style = document.createElement("style");
style.textContent = `
  .flashcard-container {
  margin-top:20px;
  width:90%;
    perspective: 1000px;
  }
  .flashcard {
    width: 100%;
    max-width: 1000px;
    height: 140px;
    margin: 0 auto 10px;
    position: relative;
    transition: transform 0.6s;
    transform-style: preserve-3d;
    cursor: pointer;
    text-align: center;
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
    margin:10px;
    
  }
  .button{
  width:100px;
  }
  .download-button {
  display: inline-block;
  padding: 10px 16px;
  background-color: #7d63f3;
  color: white;
  text-align: center;
  text-decoration: none;
  border-radius: 8px;
  font-weight: bold;
  font-size: 0.95rem;
  margin-top: 16px;
  box-shadow: 0 2px 6px rgba(0,0,0,0.1);
  transition: background-color 0.2s ease;
}

.download-button:hover {
  background-color: #6c54e6;
}

.anki-button {
  display: inline-block;
  padding: 10px 16px;
  background-color: #28a745;
  color: white;
  text-align: center;
  text-decoration: none;
  border-radius: 8px;
  font-weight: bold;
  font-size: 0.95rem;
  margin-top: 16px;
  margin-left: 10px;
  box-shadow: 0 2px 6px rgba(0,0,0,0.1);
  transition: background-color 0.2s ease;
  border: none;
  cursor: pointer;
}

.anki-button:hover {
  background-color: #218838;
}

.button-container {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-top: 16px;
}
`;
document.head.appendChild(style);

import { generateFlashcards } from "./flashcard.js";
import { summarizeArticle } from "./summary.js";
import { isAnkiConnectAvailable, getDecks, addFlashcards, syncAnki } from "./ankiConnect.js";

document.addEventListener("DOMContentLoaded", async () => {
  // Check if AnkiConnect is available and set up the Anki UI
  setupAnkiConnect();
  
  // Function to send flashcards to Anki
  window.sendToAnki = async function(flashcardsArray, title) {
    const ankiDeckSelect = document.getElementById("anki-deck");
    const selectedDeck = ankiDeckSelect.value;
    
    // Check if a deck is selected
    if (!selectedDeck) {
      alert("Please select an Anki deck first");
      return;
    }
    
    // Check if AnkiConnect is available
    try {
      const isAvailable = await isAnkiConnectAvailable();
      if (!isAvailable) {
        alert("Anki is not running or AnkiConnect is not installed. Please make sure Anki is running and the AnkiConnect add-on is installed.");
        return;
      }
      
      // Change the button text to indicate loading
      const buttons = document.querySelectorAll('.anki-button');
      buttons.forEach(button => {
        button.textContent = "Sending to Anki...";
        button.disabled = true;
        button.style.backgroundColor = "#6c757d";
      });
      
      // Send the flashcards to Anki
      const addedNotes = await addFlashcards(flashcardsArray, selectedDeck);
      
      // Sync Anki to save changes
      await syncAnki();
      
      // Show success message
      const successCount = addedNotes.filter(id => id !== null).length;
      const totalCount = flashcardsArray.length;
      
      alert(`Successfully added ${successCount} out of ${totalCount} flashcards to Anki deck "${selectedDeck}".`);
    } catch (error) {
      console.error("Error sending flashcards to Anki:", error);
      alert(`Error sending flashcards to Anki: ${error.message}`);
    } finally {
      // Restore button state regardless of success or failure
      const buttons = document.querySelectorAll('.anki-button');
      buttons.forEach(button => {
        button.textContent = "Send to Anki";
        button.disabled = false;
        button.style.backgroundColor = "#28a745";
      });
    }
  };
  
  async function setupAnkiConnect() {
    const ankiStatus = document.getElementById("anki-status");
    const ankiDeckSelect = document.getElementById("anki-deck");
    
    try {
      // Check if AnkiConnect is available
      const isAvailable = await isAnkiConnectAvailable();
      
      if (isAvailable) {
        ankiStatus.textContent = "Connected to Anki";
        ankiStatus.style.color = "#28a745";
        
        // Populate deck list
        const decks = await getDecks();
        ankiDeckSelect.innerHTML = ""; // Clear loading option
        
        // Add a default option
        const defaultOption = document.createElement("option");
        defaultOption.value = "";
        defaultOption.textContent = "-- Select a deck --";
        ankiDeckSelect.appendChild(defaultOption);
        
        // Add each deck as an option
        decks.forEach(deck => {
          const option = document.createElement("option");
          option.value = deck;
          option.textContent = deck;
          ankiDeckSelect.appendChild(option);
        });
        
        // Store selected deck in storage
        ankiDeckSelect.addEventListener("change", () => {
          chrome.storage.sync.set({ selectedDeck: ankiDeckSelect.value });
        });
        
        // Load saved deck selection
        chrome.storage.sync.get(["selectedDeck"], result => {
          if (result.selectedDeck) {
            ankiDeckSelect.value = result.selectedDeck;
          }
        });
      } else {
        // AnkiConnect not available
        ankiStatus.textContent = "Anki not running or AnkiConnect not installed";
        ankiStatus.style.color = "#dc3545";
        ankiDeckSelect.innerHTML = '<option value="">Anki not available</option>';
        ankiDeckSelect.disabled = true;
      }
    } catch (error) {
      console.error("Error setting up AnkiConnect:", error);
      ankiStatus.textContent = `Error: ${error.message}`;
      ankiStatus.style.color = "#dc3545";
      ankiDeckSelect.innerHTML = '<option value="">Error connecting to Anki</option>';
      ankiDeckSelect.disabled = true;
    }
  }
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
  document
    .getElementById("summarize")
    .addEventListener("click", summarizeContent);
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
  // Get the current URL to check for current site highlights
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    const currentTab = tabs[0];
    const currentUrl = currentTab ? currentTab.url : null;

    if (!currentUrl) {
      console.error("No active tab URL found");
      return;
    }

    // Extract hostname from the current URL
    let currentHostname = "";
    try {
      const url = new URL(currentUrl);
      currentHostname = url.hostname;
    } catch (e) {
      console.error("Error parsing current URL:", e);
      return;
    }

    // Get highlights only for the current website
    chrome.runtime.sendMessage(
      {
        action: "getHighlights",
        websiteUrl: currentUrl,
      },
      function (response) {
        if (response && response.success) {
          // Display highlights for the current site only
          displayCurrentSiteHighlights(response.highlights, currentHostname);
        } else {
          console.error(
            "Failed to load highlights:",
            response?.error || "Unknown error"
          );
        }
      }
    );
  });
}

// Function to display highlights from the current website only
function displayCurrentSiteHighlights(highlights, currentHostname) {
  const highlightsSection = document.getElementById("saved-highlights-section");
  const highlightsList = document.getElementById("highlights-list");

  // Clear existing content
  highlightsList.innerHTML = "";

  // Get highlights for the current site
  let currentSiteHighlights = [];

  // Since we're requesting specific site highlights, the response might be:
  // 1. An array of highlights directly (new format when requesting specific site)
  // 2. An object with byWebsite & allHighlights (requesting from old format)
  if (Array.isArray(highlights)) {
    currentSiteHighlights = highlights;
  } else if (highlights.byWebsite && highlights.byWebsite[currentHostname]) {
    currentSiteHighlights = highlights.byWebsite[currentHostname];
  }

  // Check if we have any highlights to display
  if (currentSiteHighlights.length > 0) {
    // Show the highlights section
    highlightsSection.style.display = "block";

    // Add a title showing the current site
    const siteHeader = document.createElement("div");
    siteHeader.className = "site-header";
    siteHeader.textContent = `Highlights from ${currentHostname}`;
    siteHeader.style.fontWeight = "bold";
    siteHeader.style.marginBottom = "10px";
    siteHeader.style.color = "white";
    siteHeader.style.textAlign = "center";

    highlightsList.appendChild(siteHeader);

    // Add a hidden input to store the current website for flashcard generation
    const websiteFilterValue = document.createElement("input");
    websiteFilterValue.type = "hidden";
    websiteFilterValue.id = "website-filter-value";
    websiteFilterValue.value = currentHostname;
    highlightsList.appendChild(websiteFilterValue);

    // Add each highlight to the list
    currentSiteHighlights.forEach((highlight) => {
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
    // Hide the section if no highlights for this site
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
        // Reload highlights to refresh the UI with the updated data
        loadSavedHighlights();
      } else {
        console.error(
          "Failed to remove highlight:",
          response?.error || "Unknown error"
        );
      }
    }
  );
}

// Function to clear all highlights from the current website
function clearAllHighlights() {
  // Get the current website from the hidden field
  const currentWebsite = document.getElementById("website-filter-value")?.value;

  if (!currentWebsite) {
    console.error("Could not determine current website");
    return;
  }

  if (
    confirm(
      `Are you sure you want to clear all highlights from ${currentWebsite}?`
    )
  ) {
    chrome.runtime.sendMessage(
      {
        action: "clearHighlights",
        websiteUrl: `https://${currentWebsite}`,
      },
      function (response) {
        if (response && response.success) {
          // Hide highlights section since all current site highlights are removed
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
    resultElement.innerHTML =
      '<div class="load-div"> <div class="loader"></div> <div>Generating flashcards from highlights...</div> </div>';
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

    // Get the current website hostname from the hidden field
    const currentWebsite = document.getElementById(
      "website-filter-value"
    )?.value;

    if (!currentWebsite) {
      resultElement.innerHTML =
        "<p>Error: Could not determine current website</p>";
      return;
    }

    // Get saved highlights for the current website only
    chrome.runtime.sendMessage(
      {
        action: "getHighlights",
        websiteUrl: `https://${currentWebsite}`,
      },
      function (response) {
        if (!response || !response.success) {
          resultElement.innerHTML = `<p>Error retrieving highlights: ${
            response?.error || "Unknown error"
          }</p>`;
          return;
        }

        // Get the highlights for the current website
        let highlights = [];

        if (Array.isArray(response.highlights)) {
          highlights = response.highlights;
        } else if (
          response.highlights.byWebsite &&
          response.highlights.byWebsite[currentWebsite]
        ) {
          highlights = response.highlights.byWebsite[currentWebsite];
        }

        if (highlights.length === 0) {
          resultElement.innerHTML =
            "<p>No highlights found for this page. Please highlight some text first.</p>";
          return;
        }

        // Add website info to title
        const websiteInfo = ` from ${currentWebsite}`;

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

              // Create a prompt with the highlighted text and article context
              const highlightTexts = highlights
                .map((h) => h.content)
                .join("\n\n---\n\n");

              // Build the prompt with both highlights and article context
              const specialPrompt = `
          For this task, I'm providing you with HIGHLIGHTED TEXT passages${websiteInfo}.
          Generate one high-quality flashcard focusing SPECIFICALLY on each of the highlighted passages.
          Use the full article for context to create better cards.
          
          ${pref ? `User preferences: ${pref}` : ""}
          
          HIGHLIGHTED PASSAGES (create cards for these specifically):
          ${highlightTexts}
          
          FULL ARTICLE (for context):
          ${fullArticle || "No article context available"}
          `;

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

              // Create a title for the download that includes the website info
              const title = `${currentWebsite}_flashcards`;

              downloadLink.download = `${title}.csv`;
              downloadLink.href = url;
              downloadLink.textContent = "Download Flashcards as CSV";
              downloadLink.style.display = "block";
              downloadLink.style.marginTop = "10px";
              downloadLink.className = "download-button";
              
              // Create button container
              const buttonContainer = document.createElement("div");
              buttonContainer.className = "button-container";
              
              // Create "Send to Anki" button
              const ankiButton = document.createElement("button");
              ankiButton.textContent = "Send to Anki";
              ankiButton.className = "anki-button";
              ankiButton.onclick = () => sendToAnki(jsonArray, `Flashcards from ${currentWebsite}`);
              
              // Add buttons to container
              buttonContainer.appendChild(downloadLink);
              buttonContainer.appendChild(ankiButton);

              // Display the extracted content with website info
              const displayTitle = `Flashcards from ${currentWebsite}`;

              resultElement.innerHTML = `
            <h2 style="text-align: center;" >${displayTitle}</h2>
          `;
              resultElement.appendChild(buttonContainer);
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
    // const resultElement = document.getElementById("result");
    const summaryElement = document.getElementById("result");

    resultElement.style.display = "flex";
    // Get the active tab
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    // Get API key from input
    const apiKey = document.getElementById("api-key").value.trim();
    const pref = document.getElementById("pref").value.trim();

    // check if page is pdf
    chrome.runtime.sendMessage(
      { action: "getPDFStatus", tabId: tab.id },
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

        const isPDF = response.isPDF;
        console.log(response);
        console.log(`Is ${tab.id} a pdf?`, isPDF);

        // Send message to the background script to handle content extraction
        chrome.runtime.sendMessage(
          {
            action: "extract",
            tabId: tab.id,
            apiKey: apiKey,
            pref: pref,
            isPDF: isPDF,
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
                    const escapedFront = `"${(front || "").replace(
                      /"/g,
                      '""'
                    )}"`;
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
                downloadLink.className = "download-button";
                
                // Create button container
                const buttonContainer = document.createElement("div");
                buttonContainer.className = "button-container";
                
                // Create "Send to Anki" button
                const ankiButton = document.createElement("button");
                ankiButton.textContent = "Send to Anki";
                ankiButton.className = "anki-button";
                ankiButton.onclick = () => sendToAnki(jsonArray, response.title || "Extracted Content");
                
                // Add buttons to container
                buttonContainer.appendChild(downloadLink);
                buttonContainer.appendChild(ankiButton);

                resultElement.innerHTML = `
            <h2 style="text-align: center;">${
              response.title || "Extracted Content"
            }</h2>`;
                resultElement.appendChild(buttonContainer);
                displayQuizletFlashcards(jsonArray);
              })

              .catch((error) => {
                console.log(error);
                resultElement.innerHTML = `<p>Error generating flashcards: ${error}</p>`;
              });
          }
        );
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

  const flashcardBox = document.createElement("div");
  flashcardBox.className = "flashcard-box";
  flashcardBox.appendChild(card);

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
  prev.className = "button";
  prev.textContent = "Previous";
  prev.onclick = () => {
    if (currentIndex > 0) {
      currentIndex--;
      updateCard();
    }
  };

  const next = document.createElement("button");
  next.textContent = "Next";
  next.className = "button";
  next.onclick = () => {
    if (currentIndex < flashcardsArray.length - 1) {
      currentIndex++;
      updateCard();
    }
  };

  controls.appendChild(prev);
  controls.appendChild(next);

  container.appendChild(flashcardBox);
  container.appendChild(controls);
  document.getElementById("result").appendChild(container);

  function updateCard() {
    front.textContent = flashcardsArray[currentIndex].front;
    back.textContent = flashcardsArray[currentIndex].back;
    card.classList.remove("flipped"); // reset to front view
  }
}
async function summarizeContent() {
  const resultElement = document.getElementById("result");
  const summaryElement = document.getElementById("result");
  const pref = document.getElementById("pref").value.trim();
  summaryElement.innerHTML =
    '<div class="load-div"> <div class="loader"></div> <div>Summarizing article...</div> </div>';
  resultElement.style.display = "flex";

  chrome.storage.sync.get(["apiKey"], async function (result) {
    const apiKey = result.apiKey ? result.apiKey : null;

    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      chrome.runtime.sendMessage(
        { action: "getPDFStatus", tabId: tab.id },
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

          const isPDF = response.isPDF;
          console.log(response);
          console.log(`Is ${tab.id} a pdf?`, isPDF);
          if (isPDF) {
            chrome.runtime.sendMessage(
              {
                action: "extract",
                tabId: tab.id,
                apiKey: apiKey,
                pref: pref,
                isPDF: isPDF,
              },
              (response) => {
                console.log("Got PDF for summary: ", response);
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
                console.log("Got PDF for summary: ", response);
                summarizeArticle(response.content, pref).then((r) => {
                  if (r.success) {
                    // resultElement.innerHTML = `<h4>Summary</h4><p>${response.content}</p>`;
                    summaryElement.innerHTML = `<p>${r.content}</p>`;
                  } else {
                    resultElement.innerHTML = `<p>Failed to summarize: ${r.error}</p>`;
                  }
                });
              }
            );
          } else {
            chrome.scripting.executeScript(
              {
                target: { tabId: tab.id },
                func: () => document.body.innerText,
              },
              async (injectionResults) => {
                const pageText = injectionResults?.[0]?.result;

                const response = await summarizeArticle(pageText, pref);

                if (response.success) {
                  // resultElement.innerHTML = `<h4>Summary</h4><p>${response.content}</p>`;
                  summaryElement.innerHTML = `<p>${response.content}</p>`;
                } else {
                  resultElement.innerHTML = `<p>Failed to summarize: ${response.error}</p>`;
                }
              }
            );
          }
        }
      );
    } catch (err) {
      console.error(err);
      resultElement.innerHTML = `<p>Error: ${err.message}</p>`;
    }
  });
}
