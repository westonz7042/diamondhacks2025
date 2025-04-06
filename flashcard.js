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
      Create ${numFlashcards} high-quality flashcards based on the following article. Follow these essential guidelines:
      
      • Each card must focus on ONE specific concept (atomic knowledge)
      • Questions should be precise and unambiguous about what they're asking
      • Answers must be EXTREMELY concise - 1-2 sentences maximum (10-25 words)
      • Focus on core concepts, relationships, and techniques rather than trivia
      • Avoid yes/no questions or questions with binary answers
      • When referencing authors, use specific names instead of "the author"
      • Questions should require genuine recall, not just recognition
      
      Consider these knowledge types:
      • For facts: Break complex facts into atomic units
      • For concepts: Address attributes, similarities/differences, and significance
      • For procedures: Focus on decision points and critical parameters
      
      ${userPreference ? userPreference : ""}
      
      Your output must be in CSV format with each row as: Question,Answer
      Do not include headers or file type information.
      
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

        //console.log("Lines", lines);
        while (
          lines[0].toLowerCase().includes("question") &&
          lines[0].toLowerCase().includes("answer")
        ) {
          lines.shift();
        }
        const csvOutput2 = lines.join("\n");

        //fs.writeFileSync("flashcards.csv", csvOutput2.trim());
        //console.log("✅ Flashcards saved to flashcards.csv");
        resolve(csvOutput2);
      } catch (error) {
        console.error("Request failed:", error);
        reject(error);
      }
    });
  });
}
