import { generateFlashcards } from "./flashcard.js";
import { displayQuizletFlashcards } from "./popup.js";

// Function to load and display saved highlights
export function loadSavedHighlights() {
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
export function displayCurrentSiteHighlights(highlights, currentHostname) {
  const highlightsSection = document.getElementById("saved-highlights-section");
  const highlightsList = document.getElementById("highlights-list");
  const extract = document.getElementById("extract");

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
export function removeHighlight(highlightId) {
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
export function clearAllHighlights() {
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
export async function generateFromHighlights() {
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

              // Display the extracted content with website info
              const displayTitle = `Flashcards from ${currentWebsite}`;
              
              // Create button container
              const buttonContainer = document.createElement("div");
              buttonContainer.className = "button-container";
              
              // Create "Send to Anki" button
              const ankiButton = document.createElement("button");
              ankiButton.textContent = "Send to Anki";
              ankiButton.className = "anki-button";
              ankiButton.onclick = () => window.sendToAnki(jsonArray, displayTitle);
              
              // Add buttons to container
              buttonContainer.appendChild(downloadLink);
              buttonContainer.appendChild(ankiButton);

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
