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

  // Load and handle saved preferences
  document.getElementById("pref").addEventListener("change", function () {
    const pref = document.getElementById("pref").value.trim();
    chrome.storage.sync.set({ pref: pref });
  });

  document.getElementById("num-cards").addEventListener("change", function () {
    const numCards = document.getElementById("num-cards").value.trim();
    chrome.storage.sync.set({ numCards: numCards });
  });
  
  // Load preferences from storage
  chrome.storage.sync.get(["pref", "numCards"], function(result) {
    if (result.pref) {
      document.getElementById("pref").value = result.pref;
    }
    if (result.numCards) {
      document.getElementById("num-cards").value = result.numCards;
    }
  });
  
  // Load saved highlights and display them
  loadSavedHighlights();
  
  // Add event listeners for the highlights section
  document.getElementById("extract").addEventListener("click", extractContent);
  document.getElementById("clear-highlights").addEventListener("click", clearAllHighlights);
  document.getElementById("generate-from-highlights").addEventListener("click", generateFromHighlights);
});

// Function to load and display saved highlights
function loadSavedHighlights() {
  chrome.runtime.sendMessage({ action: "getHighlights" }, function(response) {
    if (response && response.success && response.highlights) {
      displayHighlights(response.highlights);
    } else {
      console.error("Failed to load highlights:", response?.error || "Unknown error");
    }
  });
}

// Function to display highlights in the popup
function displayHighlights(highlights) {
  const highlightsSection = document.getElementById("saved-highlights-section");
  const highlightsList = document.getElementById("highlights-list");
  
  // Clear existing content
  highlightsList.innerHTML = '';
  
  // Check if we have any highlights
  if (highlights && highlights.length > 0) {
    // Show the highlights section
    highlightsSection.style.display = "block";
    
    // Add each highlight to the list
    highlights.forEach(highlight => {
      const highlightItem = document.createElement('div');
      highlightItem.className = 'highlight-item';
      highlightItem.style.padding = '8px';
      highlightItem.style.marginBottom = '8px';
      highlightItem.style.border = '1px solid #ddd';
      highlightItem.style.borderRadius = '4px';
      highlightItem.style.backgroundColor = '#f5f5f5';
      highlightItem.style.position = 'relative';
      
      // Create text content with truncation if needed
      const contentText = highlight.content.length > 100 
        ? highlight.content.substring(0, 100) + '...' 
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
      const removeButton = highlightItem.querySelector('.remove-highlight');
      removeButton.addEventListener('click', function(e) {
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
  chrome.runtime.sendMessage({ 
    action: "removeHighlight", 
    highlightId: highlightId 
  }, function(response) {
    if (response && response.success) {
      displayHighlights(response.highlights);
    } else {
      console.error("Failed to remove highlight:", response?.error || "Unknown error");
    }
  });
}

// Function to clear all highlights
function clearAllHighlights() {
  if (confirm("Are you sure you want to clear all saved highlights?")) {
    chrome.runtime.sendMessage({ action: "clearHighlights" }, function(response) {
      if (response && response.success) {
        document.getElementById("saved-highlights-section").style.display = "none";
      } else {
        console.error("Failed to clear highlights:", response?.error || "Unknown error");
      }
    });
  }
}

// Function to generate flashcards from the saved highlights
async function generateFromHighlights() {
  try {
    // Show loading state
    const resultElement = document.getElementById("result");
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
    const numCards = document.getElementById("num-cards").value.trim();
    
    // Get saved highlights
    chrome.runtime.sendMessage({ action: "getHighlights" }, function(response) {
      if (!response || !response.success) {
        resultElement.innerHTML = `<p>Error retrieving highlights: ${response?.error || "Unknown error"}</p>`;
        return;
      }
      
      const highlights = response.highlights || [];
      
      if (highlights.length === 0) {
        resultElement.innerHTML = "<p>No highlights found. Please highlight text on webpages first.</p>";
        return;
      }
      
      // First extract the full article for context
      chrome.tabs.sendMessage(tab.id, { 
        action: "extractContent",
        apiKey: apiKey 
      }, async (extractResponse) => {
        if (!extractResponse || !extractResponse.success) {
          // If we can't get the full article, just use the highlights
          processHighlightsOnly(highlights, apiKey, pref, numCards);
          return;
        }
        
        try {
          // We have the full article, generate cards with context
          const fullArticle = extractResponse.content;
          
          // Create a special prompt that combines the highlights with the full article context
          const highlightTexts = highlights.map(h => h.content).join('\n\n---\n\n');
          
          const specialPrompt = `
          For this task, I'm providing you with HIGHLIGHTED TEXT passages from an article.
          Generate ${numCards} high-quality flashcards focusing SPECIFICALLY on the highlighted passages.
          Use the full article for context to create better cards.
          
          ${pref ? `User preferences: ${pref}` : ''}
          
          HIGHLIGHTED PASSAGES (create cards for these specifically):
          ${highlightTexts}
          
          FULL ARTICLE (for context):
          ${fullArticle}
          `;
          
          // Generate the flashcards from the combined data
          const flashcards = await generateFlashcards(specialPrompt, null, numCards);
          
          // Display the results
          const blob = new Blob([flashcards], { type: "text/csv" });
          const url = URL.createObjectURL(blob);
          const downloadLink = document.createElement("a");
          const sanitizedTitle = extractResponse.title
            ? extractResponse.title.replace(/[^\w\s]/gi, "")
            : "flashcards_from_highlights";
          downloadLink.download = `${sanitizedTitle}_flashcards.csv`;
          downloadLink.href = url;
          downloadLink.textContent = "Download Flashcards as CSV";
          downloadLink.style.display = "block";
          downloadLink.style.marginTop = "10px";
          
          // Display the extracted content
          resultElement.innerHTML = `
            <h4>${extractResponse.title || "Flashcards From Highlights"}</h4>
            <div>${flashcards}</div>
          `;
          resultElement.appendChild(downloadLink);
          displayQuizletFlashcards(flashcards);
          
        } catch (error) {
          console.error("Error generating flashcards:", error);
          resultElement.innerHTML = `<p>Error generating flashcards: ${error}</p>`;
        }
      });
    });
  } catch (error) {
    console.error("Error in generate from highlights:", error);
    document.getElementById("result").innerHTML = `<p>Error: ${error.message}</p>`;
  }
}

// Function to process highlights without full article context
async function processHighlightsOnly(highlights, apiKey, pref, numCards) {
  try {
    const resultElement = document.getElementById("result");
    
    // Combine all highlights
    const highlightTexts = highlights.map(h => h.content).join('\n\n---\n\n');
    
    // Create a prompt using just the highlights
    const prompt = `
    Generate ${numCards} high-quality flashcards based on these excerpts:
    
    ${pref ? `User preferences: ${pref}` : ''}
    
    Text:
    ${highlightTexts}
    `;
    
    // Generate the flashcards
    const flashcards = await generateFlashcards(prompt, null, numCards);
    
    // Display the results
    const blob = new Blob([flashcards], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const downloadLink = document.createElement("a");
    downloadLink.download = `flashcards_from_highlights.csv`;
    downloadLink.href = url;
    downloadLink.textContent = "Download Flashcards as CSV";
    downloadLink.style.display = "block";
    downloadLink.style.marginTop = "10px";
    
    resultElement.innerHTML = `
      <h4>Flashcards From Highlights</h4>
      <div>${flashcards}</div>
    `;
    resultElement.appendChild(downloadLink);
    displayQuizletFlashcards(flashcards);
    
  } catch (error) {
    console.error("Error processing highlights:", error);
    document.getElementById("result").innerHTML = `<p>Error processing highlights: ${error}</p>`;
  }
}

async function extractContent() {
  try {
    // Show loading state
    const resultElement = document.getElementById("result");
    resultElement.innerHTML = "<p>Extracting and cleaning content...</p>";

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

        // Generate flashcards from the cleaned content
        generateFlashcards(response.content, pref, numCards)
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
            displayQuizletFlashcards(flashcards);
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
function displayQuizletFlashcards(csvText) {
  const lines = csvText.trim().split("\n");
  const flashcards = lines.map((line) => {
    const [question, answer] = line.split(/,(.+)/);
    return {
      question: question.replace(/^\"|\"$/g, ""),
      answer: answer.replace(/^\"|\"$/g, ""),
    };
  });

  let currentIndex = 0;

  const container = document.createElement("div");
  container.id = "quizlet-container";
  container.className = "flashcard-container";

  const card = document.createElement("div");
  card.className = "flashcard";

  const front = document.createElement("div");
  front.className = "flashcard-face front";
  front.textContent = flashcards[currentIndex].question;

  const back = document.createElement("div");
  back.className = "flashcard-face back";
  back.textContent = flashcards[currentIndex].answer;

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
    if (currentIndex < flashcards.length - 1) {
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
    front.textContent = flashcards[currentIndex].question;
    back.textContent = flashcards[currentIndex].answer;
    card.classList.remove("flipped"); // reset to front view
  }
}
