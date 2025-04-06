let API_KEY = "";
// Function to create the endpoint URL with the latest API key
function getEndpoint() {
  return `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;
}

export async function summarizeArticle(text, userPreference) {
  // Get the latest API key from storage
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get(["apiKey"], async function (result) {
      if (result.apiKey) {
        API_KEY = result.apiKey;
      }

      try {
        const response = await fetch(getEndpoint(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `Summarize this with main ideas at the level of a university student. Do not provide HTML syntax, or provide safe HTML injection-proof responses:${
                      userPreference ? userPreference : ""
                    }\n\n${text}`,
                  },
                ],
              },
            ],
          }),
        });

        const data = await response.json();
        if (data.error) {
          console.error("API Error:", data.error);
          reject({ error: data.error.message, success: false });
          return;
        }

        const summary = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!summary) {
          console.error("No summary found in the response.");
          reject({ error: "No summary found in response", success: false });
          return;
        }
        console.log(userPreference);
        console.log("📄 Summary created successfully");
        resolve({ content: summary, success: true });
      } catch (error) {
        console.error("Summarization request failed:", error);
        reject({ error: error.message, success: false });
      }
    });
  });
}
