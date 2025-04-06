//flashcard.js

// We get the API key from storage
let API_KEY = "";

// Function to create the endpoint URL with the latest API key
function getEndpoint() {
  return `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;
}

const numFlashcards = 5;

export async function generateFlashcards(text, userPreference, numFlashcards) {
  // Get the latest API key from storage
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get(["apiKey"], async function (result) {
      if (result.apiKey) {
        API_KEY = result.apiKey;
      }

      const prompt = `
      Create ${numFlashcards} flashcards based on the following article. Only include facts, definitions, or concepts that would help someone understand or study the topic. 
      ${userPreference ? userPreference : ""}
      Simply output an array of json objects where it needs to be {"front":question, "back":answer}. Do not include the word json. Do not 
      Article:
      \n\n${text}
      `;

      try {
        const response = await fetch(getEndpoint(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: prompt }],
              },
            ],
          }),
        });

        const data = await response.json();
        if (data.error) {
          console.error("API Error:", data.error.message);
          reject(data.error.message);
          return;
        }

        const csvOutput = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!csvOutput) {
          console.error("No flashcard content returned.");
          reject("No flashcard content returned");
          return;
        }
        const lines = csvOutput.trim().split("\n");
        while (
          lines[0].toLowerCase().includes("question") &&
          lines[0].toLowerCase().includes("answer")
        ) {
          lines.shift();
        }
        const csvOutput2 = lines.join("\n");
        resolve(csvOutput2);
      } catch (error) {
        console.error("Request failed:", error);
        reject(error);
      }
    });
  });
}
