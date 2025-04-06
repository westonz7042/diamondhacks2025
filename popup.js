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

  //num cards
  document.getElementById("num-cards").addEventListener("change", function () {
    const pref = document.getElementById("num-cards").value.trim();
    chrome.storage.sync.set({ numCards: numCards });
  });

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
          .then((flashcardsArray) => {
            // resultElement.innerHTML = `</h4><h4>${flashcardsArray}</h4>`;
            // Convert to CSV string for download
            // let x = JSON.parse(flashcardsArray);
            let trimmedArray = flashcardsArray.trim().replace(/^```|```$/g, "");
            let jsonArray = JSON.parse(trimmedArray);
            const csvContent = jsonArray
              .map(({ front, back }) => {
                const escapedFront = `"${(front || "").replace(/"/g, '""')}"`;
                const escapedBack = `"${(back || "").replace(/"/g, '""')}"`;
                return `${escapedFront},${escapedBack}`;
              })
              .join("\n");

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
function displayQuizletFlashcards(flashcardsArray) {
  let currentIndex = 0;

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
