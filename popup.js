// popup.js

import { generateFlashcards } from "./flashcard.js";
import { summarizeArticle } from "./summary.js";
import * as highlights from "./highlights.js";

document.addEventListener("DOMContentLoaded", () => {
  let keyHidden = true;
  let summarize = true;

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
  const hideKey = document.getElementById("hide-key");
  hideKey.addEventListener("click", () => {
    keyHidden = !keyHidden;
    hideKey.textContent = keyHidden ? "Show API-key" : "Hide API-key";
    document.getElementById("key-container").style = keyHidden
      ? "display: none"
      : "display: block";
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

                resultElement.innerHTML = `
            <h2 style="text-align: center;">${
              response.title || "Extracted Content"
            }</h2>`;
                resultElement.appendChild(downloadLink);
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
