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
  let keyHidden = false; // Changed to false to show API key by default
  let summarize = true;

  // Get reference to the hide key button early
  const hideKey = document.getElementById("hide-key");

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
        const errorMessage = "Some flashcards couldn't be added because they already exist in your Anki deck.";
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
  // Load saved API key and hidden state if exists
  chrome.storage.sync.get(["apiKey", "keyHidden"], function (result) {
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

  // Load preferences from storage
  chrome.storage.sync.get(["pref"], function (result) {
    if (result.pref) {
      document.getElementById("pref").value = result.pref;
    }
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
                    const sanitizedTitle =
                      response.title?.replace(/[^\w\s]/gi, "") || "flashcards";
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
            <h2 style="text-align: center; margin: 0px; ">${
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
  front.textContent = escapeHTML(flashcardsArray[currentIndex].front);

  const back = document.createElement("div");
  back.className = "flashcard-face back";
  back.textContent = escapeHTML(flashcardsArray[currentIndex].back);

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
  const nums = document.createElement("div");
  nums.textContent = `${currentIndex + 1}/${flashcardsArray.length}`;
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
  controls.appendChild(nums);
  controls.appendChild(next);

  container.appendChild(flashcardBox);
  container.appendChild(controls);
  document.getElementById("result").appendChild(container);

  function updateCard() {
    if (card.classList.contains("flipped")) {
      card.classList.remove("flipped"); // reset to front view
      setTimeout(() => {
        front.textContent = flashcardsArray[currentIndex].front;
        back.textContent = flashcardsArray[currentIndex].back;
        nums.textContent = `${currentIndex + 1}/${flashcardsArray.length}`;
      }, 200);
    } else {
      front.textContent = flashcardsArray[currentIndex].front;
      back.textContent = flashcardsArray[currentIndex].back;
      nums.textContent = `${currentIndex + 1}/${flashcardsArray.length}`;
    }
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
                    resultElement.innerHTML = `<p>${escapeHTML(r.content)}</p>`;
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
                  resultElement.innerHTML = `<p>${escapeHTML(
                    response.content
                  )}</p>`;
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
