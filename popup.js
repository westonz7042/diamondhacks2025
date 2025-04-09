// popup.js

import { generateFlashcards } from "./flashcard.js";
import { summarizeArticle } from "./summary.js";
import * as highlights from "./highlights.js";
import {
  isAnkiConnectAvailable,
  getDecks,
  addFlashcards,
  syncAnki,
} from "./ankiConnect.js";

document.addEventListener("DOMContentLoaded", async () => {
  // Check if AnkiConnect is available and set up the Anki UI
  setupAnkiConnect();
  // Check for previously stored flashcards
  checkForPreviousFlashcards();
  
  let keyHidden = false; // Changed to false to show API key by default
  let promptHidden = false; // Initially show prompt preference
  let summarize = true;

  // Get reference to the hide key button early
  const hideKey = document.getElementById("hide-key");
  const hidePrompt = document.getElementById("hide-prompt");

  // Function to send flashcards to Anki
  window.sendToAnki = async function (flashcardsArray, title) {
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
        alert(
          "Anki is not running or AnkiConnect is not installed. Please make sure Anki is running and the AnkiConnect add-on is installed."
        );
        return;
      }

      // Change the button text to indicate loading
      const buttons = document.querySelectorAll(".anki-button");
      buttons.forEach((button) => {
        button.textContent = "Sending to Anki...";
        button.disabled = true;
        button.style.backgroundColor = "#6c757d";
      });

      // Send the flashcards to Anki
      const addedNotes = await addFlashcards(flashcardsArray, selectedDeck);

      // Try to sync Anki but don't fail if sync auth isn't configured
      try {
        await syncAnki();
      } catch (syncError) {
        console.warn("Anki sync failed:", syncError);
        // Continue execution - this is not a critical error
      }

      // Show success message
      const successCount = addedNotes.filter((id) => id !== null).length;
      const totalCount = flashcardsArray.length;

      alert(
        `Successfully added ${successCount} out of ${totalCount} flashcards to Anki deck "${selectedDeck}".`
      );
    } catch (error) {
      console.error("Error sending flashcards to Anki:", error);

      // Check for duplicate error messages
      if (error.message && error.message.includes("duplicate")) {
        // Create a more user-friendly message for duplicate cards
        const errorMessage =
          "Some flashcards couldn't be added because they already exist in your Anki deck.";
        alert(errorMessage);
      } else {
        // Show the original error for other types of errors
        alert(`Error sending flashcards to Anki: ${error.message}`);
      }
    } finally {
      // Restore button state regardless of success or failure
      const buttons = document.querySelectorAll(".anki-button");
      buttons.forEach((button) => {
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
        decks.forEach((deck) => {
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
        chrome.storage.sync.get(["selectedDeck"], (result) => {
          if (result.selectedDeck) {
            ankiDeckSelect.value = result.selectedDeck;
          }
        });
      } else {
        // AnkiConnect not available
        ankiStatus.textContent =
          "Anki not running or AnkiConnect not installed";
        ankiStatus.style.color = "#dc3545";
        ankiDeckSelect.innerHTML =
          '<option value="">Anki not available</option>';

        ankiDeckSelect.disabled = true;
      }
    } catch (error) {
      console.error("Error setting up AnkiConnect:", error);
      ankiStatus.textContent = `Error: ${error.message}`;
      ankiStatus.style.color = "#dc3545";
      ankiDeckSelect.innerHTML =
        '<option value="">Error connecting to Anki</option>';
      ankiDeckSelect.disabled = true;
    }
  }
  
  // Load saved API key, prompt preference, model selection, and hidden states
  chrome.storage.sync.get(["apiKey", "keyHidden", "promptHidden", "pref", "selectedModel"], function (result) {
    if (result.apiKey) {
      document.getElementById("api-key").value = result.apiKey;
    }

    // If user has previously used the extension and chosen to hide the API key
    if (result.keyHidden !== undefined) {
      keyHidden = result.keyHidden;
      hideKey.textContent = keyHidden ? "Show API-key" : "Hide API-key";
      document.getElementById("key-container").style.display = keyHidden
        ? "none"
        : "block";
    }
    
    // If user has previously chosen to hide the prompt preference
    if (result.promptHidden !== undefined) {
      promptHidden = result.promptHidden;
      hidePrompt.textContent = promptHidden ? "Show Prompt" : "Hide Prompt";
      document.getElementById("prompt-container").style.display = promptHidden
        ? "none"
        : "block";
    }
    
    // Load saved prompt preference
    if (result.pref) {
      document.getElementById("pref").value = result.pref;
    }
    
    // Load saved model selection
    if (result.selectedModel) {
      document.getElementById("model-select").value = result.selectedModel;
    }
  });

  // Save API key when it changes
  document.getElementById("api-key").addEventListener("change", function () {
    const apiKey = document.getElementById("api-key").value.trim();
    chrome.storage.sync.set({ apiKey: apiKey });
  });

  const generator = document.getElementById("generate");
  document.getElementById("extract").addEventListener("click", (e) => {
    e.stopImmediatePropagation();
    summarize = false;
    generator.textContent = "Generate Flashcards";
  });
  document.getElementById("summarize").addEventListener("click", (e) => {
    e.stopImmediatePropagation();
    summarize = true;
    generator.textContent = "Generate Summary";
  });

  document.getElementById("generate").addEventListener("click", (e) => {
    if (summarize) summarizeContent();
    else extractContent();
  });

  // prompts
  document.getElementById("pref").addEventListener("change", function () {
    const pref = document.getElementById("pref").value.trim();
    chrome.storage.sync.set({ pref: pref });
  });
  
  // save model selection
  document.getElementById("model-select").addEventListener("change", function () {
    const selectedModel = document.getElementById("model-select").value;
    chrome.storage.sync.set({ selectedModel: selectedModel });
    console.log("Model changed to:", selectedModel);
  });

  // Styling
  const checkbox = document.getElementById("show-key");
  checkbox.addEventListener("click", (event) => {
    document.getElementById("api-key").type = checkbox.checked
      ? "text"
      : "password";
  });

  // Set up hide key button click handler
  hideKey.addEventListener("click", () => {
    keyHidden = !keyHidden;
    hideKey.textContent = keyHidden ? "Show API-key" : "Hide API-key";
    document.getElementById("key-container").style.display = keyHidden
      ? "none"
      : "block";

    // Save the key visibility preference to storage
    chrome.storage.sync.set({ keyHidden: keyHidden });
  });
  
  // Set up hide prompt button click handler
  hidePrompt.addEventListener("click", () => {
    promptHidden = !promptHidden;
    hidePrompt.textContent = promptHidden ? "Show Prompt" : "Hide Prompt";
    document.getElementById("prompt-container").style.display = promptHidden
      ? "none"
      : "block";

    // Save the prompt visibility preference to storage
    chrome.storage.sync.set({ promptHidden: promptHidden });
  });

  // Load saved highlights and display them
  highlights.loadSavedHighlights();

  // Add event listeners for the highlights section
  document
    .getElementById("clear-highlights")
    .addEventListener("click", highlights.clearAllHighlights);
  document
    .getElementById("generate-from-highlights")
    .addEventListener("click", highlights.generateFromHighlights);
    
  // Add event listener for loading previous flashcards
  document
    .getElementById("load-previous-flashcards")
    .addEventListener("click", loadPreviousFlashcards);
});

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
              .then(async (flashcardsData) => {
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
                
                // Store the flashcards in Chrome storage with page title
                const pageData = {
                  title: response.title || "Untitled Page",
                  timestamp: Date.now(),
                  flashcards: jsonArray,
                  url: tab.url
                };
                
                // Save to Chrome storage
                chrome.storage.local.set({ 'lastFlashcards': pageData }, function() {
                  console.log('Flashcards saved to storage');
                });

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
                // Define sanitizedTitle before using it
                const sanitizedTitle =
                  response.title?.replace(/[^\w\s]/gi, "") || "flashcards";

                try {
                  if ("showSaveFilePicker" in window) {
                    const handle = await window.showSaveFilePicker({
                      suggestedName: `${sanitizedTitle}_flashcards.csv`,
                      types: [
                        {
                          description: "CSV file",
                          accept: { "text/csv": [".csv"] },
                        },
                      ],
                    });

                    const writable = await handle.createWritable();
                    await writable.write(blob);
                    await writable.close();

                    console.log("✅ File saved successfully");
                  } else {
                    // Fallback: auto-download if picker is not supported
                    const url = URL.createObjectURL(blob);
                    const fallbackLink = document.createElement("a");
                    fallbackLink.href = url;
                    fallbackLink.download = `${sanitizedTitle}_flashcards.csv`;
                    fallbackLink.click();
                  }
                } catch (err) {
                  console.error("❌ Save canceled or failed:", err);
                }

                // Create button container
                const buttonContainer = document.createElement("div");
                buttonContainer.className = "button-container";

                // Create "Send to Anki" button
                const ankiButton = document.createElement("button");
                ankiButton.textContent = "Send to Anki";
                ankiButton.className = "anki-button";
                ankiButton.onclick = () =>
                  sendToAnki(jsonArray, response.title || "Extracted Content");

                // Add buttons to container

                //Make CSV button
                const saveCsvButton = document.createElement("button");
                saveCsvButton.textContent = "Save Flashcards as CSV";
                saveCsvButton.className = "save-button"; // Style it however you like
                saveCsvButton.onclick = async () => {
                  try {
                    // Reuse the same sanitizedTitle variable defined above
                    const blob = new Blob([csvContent], { type: "text/csv" });

                    if ("showSaveFilePicker" in window) {
                      const handle = await window.showSaveFilePicker({
                        suggestedName: `${sanitizedTitle}_flashcards.csv`,
                        types: [
                          {
                            description: "CSV file",
                            accept: { "text/csv": [".csv"] },
                          },
                        ],
                      });

                      const writable = await handle.createWritable();
                      await writable.write(blob);
                      await writable.close();
                    } else {
                      const url = URL.createObjectURL(blob);
                      const fallbackLink = document.createElement("a");
                      fallbackLink.href = url;
                      fallbackLink.download = `${sanitizedTitle}_flashcards.csv`;
                      fallbackLink.click();
                    }
                  } catch (err) {
                    console.error("❌ Save canceled or failed:", err);
                  }
                };
                buttonContainer.appendChild(saveCsvButton);
                buttonContainer.appendChild(ankiButton);

                resultElement.innerHTML = `
            <h2 style="text-align: center; margin: 0px; gap: 0px;">${
              escapeHTML(response.title) || "Extracted Content"
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
export function displayQuizletFlashcards(flashcardsData) {
  let currentIndex = 0;
  let isEditing = false;
  // References to content elements that we'll update
  let frontContent;
  let backContent;

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

  // Create front face with content div
  const front = document.createElement("div");
  front.className = "flashcard-face front";
  
  frontContent = document.createElement("div");
  frontContent.className = "card-content";
  frontContent.textContent = escapeHTML(flashcardsArray[currentIndex].front);
  front.appendChild(frontContent);

  // Create back face with content div
  const back = document.createElement("div");
  back.className = "flashcard-face back";
  
  backContent = document.createElement("div");
  backContent.className = "card-content";
  backContent.textContent = escapeHTML(flashcardsArray[currentIndex].back);
  back.appendChild(backContent);

  // Create edit buttons for both faces
  const frontEditBtn = document.createElement("button");
  frontEditBtn.className = "edit-button";
  frontEditBtn.textContent = "Edit";
  frontEditBtn.onclick = (e) => {
    e.stopPropagation(); // Prevent card flip
    startEditing('front');
  };

  const backEditBtn = document.createElement("button");
  backEditBtn.className = "edit-button";
  backEditBtn.textContent = "Edit";
  backEditBtn.onclick = (e) => {
    e.stopPropagation(); // Prevent card flip
    startEditing('back');
  };

  front.appendChild(frontEditBtn);
  back.appendChild(backEditBtn);

  card.appendChild(front);
  card.appendChild(back);

  card.addEventListener("click", () => {
    // Only allow flipping if we're not in edit mode
    if (!isEditing) {
      card.classList.toggle("flipped");
    }
  });

  const controls = document.createElement("div");
  controls.className = "flashcard-controls";

  const prev = document.createElement("button");
  prev.className = "button";
  prev.textContent = "Previous";
  const nums = document.createElement("div");
  nums.textContent = `${currentIndex + 1}/${flashcardsArray.length}`;
  prev.onclick = () => {
    if (currentIndex > 0 && !isEditing) {
      currentIndex--;
      updateCard();
    }
  };

  const next = document.createElement("button");
  next.textContent = "Next";
  next.className = "button";
  next.onclick = () => {
    if (currentIndex < flashcardsArray.length - 1 && !isEditing) {
      currentIndex++;
      updateCard();
    }
  };

  controls.appendChild(prev);
  controls.appendChild(nums);
  controls.appendChild(next);

  container.appendChild(flashcardBox);
  container.appendChild(controls);
  document.getElementById("result").appendChild(container);

  function updateCard() {
    // Get the current card's content from the array
    const currentFront = flashcardsArray[currentIndex].front;
    const currentBack = flashcardsArray[currentIndex].back;
    
    console.log(`Showing card ${currentIndex + 1}: Front="${currentFront}", Back="${currentBack}"`);
    
    if (card.classList.contains("flipped")) {
      card.classList.remove("flipped"); // reset to front view
      setTimeout(() => {
        frontContent.textContent = currentFront;
        backContent.textContent = currentBack;
        nums.textContent = `${currentIndex + 1}/${flashcardsArray.length}`;
      }, 200);
    } else {
      frontContent.textContent = currentFront;
      backContent.textContent = currentBack;
      nums.textContent = `${currentIndex + 1}/${flashcardsArray.length}`;
    }
  }

  // Edit functionality
  function startEditing(side) {
    isEditing = true;
    const currentFace = side === 'front' ? front : back;
    // Get the specific content for the current card at the current index
    const currentContent = flashcardsArray[currentIndex][side];
    
    console.log(`Starting to edit card ${currentIndex + 1} ${side}: "${currentContent}"`);
    
    // Clear the face content
    while (currentFace.firstChild) {
      currentFace.removeChild(currentFace.firstChild);
    }

    // Create textarea for editing
    const textarea = document.createElement("textarea");
    textarea.className = "edit-textarea";
    textarea.value = currentContent;
    currentFace.appendChild(textarea);
    textarea.focus();

    // Create save/cancel buttons
    const editControls = document.createElement("div");
    editControls.className = "edit-controls";

    const saveBtn = document.createElement("button");
    saveBtn.className = "edit-save";
    saveBtn.textContent = "Save";
    saveBtn.onclick = (e) => {
      e.stopPropagation(); // Prevent card flip
      saveEdit(side, textarea.value);
    };

    const cancelBtn = document.createElement("button");
    cancelBtn.className = "edit-cancel";
    cancelBtn.textContent = "Cancel";
    cancelBtn.onclick = (e) => {
      e.stopPropagation(); // Prevent card flip
      cancelEdit(side);
    };

    editControls.appendChild(saveBtn);
    editControls.appendChild(cancelBtn);
    currentFace.appendChild(editControls);
  }

  function saveEdit(side, newContent) {
    // Update ONLY the current flashcard's data
    flashcardsArray[currentIndex][side] = newContent;
    isEditing = false;
    
    // Restore the card face with new content
    resetCardFace(side);
    
    console.log(`Updated card ${currentIndex + 1} ${side} to: ${newContent}`);
  }

  function cancelEdit(side) {
    isEditing = false;
    resetCardFace(side);
  }

  function resetCardFace(side) {
    const currentFace = side === 'front' ? front : back;
    // Get current card's specific content
    const currentContent = flashcardsArray[currentIndex][side];
    
    // Clear the face
    while (currentFace.firstChild) {
      currentFace.removeChild(currentFace.firstChild);
    }

    // Restore content and edit button
    const contentDiv = document.createElement("div");
    contentDiv.className = "card-content";
    contentDiv.textContent = currentContent;
    currentFace.appendChild(contentDiv);

    const editBtn = document.createElement("button");
    editBtn.className = "edit-button";
    editBtn.textContent = "Edit";
    editBtn.onclick = (e) => {
      e.stopPropagation();
      startEditing(side);
    };
    currentFace.appendChild(editBtn);

    // Update the correct content reference
    if (side === 'front') {
      frontContent = contentDiv;
    } else {
      backContent = contentDiv;
    }
    
    // Make sure CSV and Anki export will use the updated data
    updateExportButtons();
  }
  
  // Update the export buttons to use the latest flashcard data
  function updateExportButtons() {
    // Update the "Send to Anki" button
    const ankiButtons = document.querySelectorAll(".anki-button");
    ankiButtons.forEach(button => {
      // Remove old event listeners by cloning the button
      const newAnkiButton = button.cloneNode(true);
      button.parentNode.replaceChild(newAnkiButton, button);
      
      // Add updated event listener
      newAnkiButton.onclick = () => sendToAnki(flashcardsArray, "Edited Flashcards");
    });
    
    // Update the "Save as CSV" button
    const csvButtons = document.querySelectorAll(".save-button");
    csvButtons.forEach(button => {
      // Remove old event listeners by cloning the button
      const newCsvButton = button.cloneNode(true);
      button.parentNode.replaceChild(newCsvButton, button);
      
      // Add updated event listener with latest data
      newCsvButton.onclick = async () => {
        try {
          // Convert JSON to CSV format
          const csvContent = flashcardsArray
            .map(({ front, back }) => {
              const escapedFront = `"${(front || "").replace(/"/g, '""')}"`;
              const escapedBack = `"${(back || "").replace(/"/g, '""')}"`;
              return `${escapedFront},${escapedBack}`;
            })
            .join("\n");
            
          const blob = new Blob([csvContent], { type: "text/csv" });
          const sanitizedTitle = "edited_flashcards";
          
          if ("showSaveFilePicker" in window) {
            const handle = await window.showSaveFilePicker({
              suggestedName: `${sanitizedTitle}.csv`,
              types: [
                {
                  description: "CSV file",
                  accept: { "text/csv": [".csv"] },
                },
              ],
            });
            
            const writable = await handle.createWritable();
            await writable.write(blob);
            await writable.close();
          } else {
            const url = URL.createObjectURL(blob);
            const fallbackLink = document.createElement("a");
            fallbackLink.href = url;
            fallbackLink.download = `${sanitizedTitle}.csv`;
            fallbackLink.click();
          }
        } catch (err) {
          console.error("❌ Save canceled or failed:", err);
        }
      };
    });
  }
}
async function summarizeContent() {
  const resultElement = document.getElementById("result");
  const pref = document.getElementById("pref").value.trim();
  resultElement.innerHTML =
    '<div class="load-div"> <div class="loader"></div> <div>Summarizing content...</div> </div>';
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
                summarizeArticle(response.content, pref).then((r) => {
                  if (r.success) {
                    const formattedContent = formatSummary(r.content);
                    resultElement.innerHTML = `
                      <h4 style="text-align: center; margin-bottom: 15px;">Summary</h4>
                      ${formattedContent}
                    `;
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
                  const formattedContent = formatSummary(response.content);
                  resultElement.innerHTML = `
                    <h4 style="text-align: center; margin-bottom: 15px;">Summary</h4>
                    ${formattedContent}
                  `;
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
function escapeHTML(html) {
  return html
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatSummary(content) {
  // Split the content into paragraphs or bullet points
  const paragraphs = content.split("\n").filter((p) => p.trim() !== "");

  // Wrap each paragraph in a <p> tag or format bullet points
  return paragraphs
    .map((paragraph) => {
      // Handle bullet points (lines starting with "*" or "-")
      if (/^\s*[\*\-]\s+/.test(paragraph)) {
        const cleanedText = paragraph.replace(/^\s*[\*\-]\s+/, ""); // Remove the leading "*" or "-"
        return `<ul style="margin-left: 0px; padding-left: 0px;"><li>${convertToBold(
          escapeHTML(cleanedText)
        )}</li></ul>`;
      } else {
        // Format as a regular paragraph
        return `<p>${convertToBold(escapeHTML(paragraph))}</p>`;
      }
    })
    .join("");
}

// Helper function to convert **text** to <strong>text</strong>
function convertToBold(text) {
  return text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
}

// Function to check for previously saved flashcards
function checkForPreviousFlashcards() {
  // First get the current tab URL
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    if (!tabs || !tabs[0] || !tabs[0].url) {
      console.error("Could not get current tab URL");
      return;
    }
    
    const currentTabUrl = tabs[0].url;
    
    // Get saved flashcards
    chrome.storage.local.get(['lastFlashcards'], function(result) {
      if (result.lastFlashcards) {
        const flashcardsSection = document.getElementById('previous-flashcards-section');
        const infoElement = document.getElementById('previous-flashcards-info');
        
        const pageData = result.lastFlashcards;
        
        // Only show if the saved flashcards are from the current URL
        if (pageData.url === currentTabUrl) {
          const timeAgo = getTimeAgo(pageData.timestamp);
          
          // Show the section
          flashcardsSection.style.display = 'block';
          
          // Update info text
          infoElement.textContent = `${pageData.title} (${timeAgo})`;
        } else {
          // Different URL, hide the section
          flashcardsSection.style.display = 'none';
        }
      }
    });
  });
}

// Function to get human-readable time difference
function getTimeAgo(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;
  
  // Convert to minutes, hours, days
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) {
    return `${days} day${days > 1 ? 's' : ''} ago`;
  } else if (hours > 0) {
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  } else if (minutes > 0) {
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  } else {
    return 'just now';
  }
}

// Function to load previously saved flashcards
function loadPreviousFlashcards() {
  // First get current tab URL
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    if (!tabs || !tabs[0] || !tabs[0].url) {
      console.error("Could not get current tab URL");
      return;
    }
    
    const currentTabUrl = tabs[0].url;
    
    chrome.storage.local.get(['lastFlashcards'], function(result) {
      if (result.lastFlashcards) {
        const pageData = result.lastFlashcards;
        
        // Only load if the saved flashcards are from the current URL
        if (pageData.url === currentTabUrl) {
          const resultElement = document.getElementById('result');
          resultElement.innerHTML = '';
          resultElement.style.display = 'flex';
          
          const jsonArray = pageData.flashcards;
      
          // Create button container
          const buttonContainer = document.createElement("div");
          buttonContainer.className = "button-container";
          
          // Create "Save as CSV" button
          const saveCsvButton = document.createElement("button");
          saveCsvButton.textContent = "Save Flashcards as CSV";
          saveCsvButton.className = "save-button";
          saveCsvButton.onclick = async () => {
            try {
              // Convert JSON to CSV format
              const csvContent = jsonArray
                .map(({ front, back }) => {
                  const escapedFront = `"${(front || "").replace(/"/g, '""')}"`;
                  const escapedBack = `"${(back || "").replace(/"/g, '""')}"`;
                  return `${escapedFront},${escapedBack}`;
                })
                .join("\n");
                
              const blob = new Blob([csvContent], { type: "text/csv" });
              const sanitizedTitle = pageData.title.replace(/[^\w\s]/gi, "") || "flashcards";
              
              if ("showSaveFilePicker" in window) {
                const handle = await window.showSaveFilePicker({
                  suggestedName: `${sanitizedTitle}.csv`,
                  types: [
                    {
                      description: "CSV file",
                      accept: { "text/csv": [".csv"] },
                    },
                  ],
                });
                
                const writable = await handle.createWritable();
                await writable.write(blob);
                await writable.close();
              } else {
                const url = URL.createObjectURL(blob);
                const fallbackLink = document.createElement("a");
                fallbackLink.href = url;
                fallbackLink.download = `${sanitizedTitle}.csv`;
                fallbackLink.click();
              }
            } catch (err) {
              console.error("❌ Save canceled or failed:", err);
            }
          };
          
          // Create "Send to Anki" button
          const ankiButton = document.createElement("button");
          ankiButton.textContent = "Send to Anki";
          ankiButton.className = "anki-button";
          ankiButton.onclick = () => sendToAnki(jsonArray, pageData.title);
          
          // Add buttons to container
          buttonContainer.appendChild(saveCsvButton);
          buttonContainer.appendChild(ankiButton);
          
          resultElement.innerHTML = `
            <h2 style="text-align: center; margin: 0px; gap: 0px;">${escapeHTML(pageData.title)}</h2>
          `;
          resultElement.appendChild(buttonContainer);
          
          // Display the flashcards
          displayQuizletFlashcards(jsonArray);
        } else {
          console.log("Previous flashcards are for a different URL, not loading");
        }
      }
    });
  });
}

// Helper function to escape HTML for safe rendering