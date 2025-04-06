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
import { summarizeArticle } from "./summary.js";
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

              // Display the extracted content with website info
              const displayTitle = `Flashcards from ${currentWebsite}`;

              resultElement.innerHTML = `
            <h4>${displayTitle}</h4>
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
    // const resultElement = document.getElementById("result");
    const summaryElement = document.getElementById("result");
    // summaryElement.innerHTML =
    //   '<div class="load-div"> <div class="loader"></div> <div>Summarizing article...</div> </div>';

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

                resultElement.innerHTML = `
            <h4>${response.title || "Extracted Content"}</h4>`;
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
async function summarizeContent() {
  const resultElement = document.getElementById("result");
  const summaryElement = document.getElementById("result");
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
                summarizeArticle(response.content).then((r) => {
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

                const response = await summarizeArticle(pageText);

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
