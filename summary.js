require("dotenv").config();
const API_KEY = process.env.API_KEY;
const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;
const articleText = `text`;
async function summarizeArticle(text) {
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `Summarize this with more detail for a university student level:\n\n${text}`,
              },
            ],
          },
        ],
      }),
    });

    const data = await response.json();
    if (data.error) {
      console.error("API Error:", data.error);
      return;
    }

    const summary = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!summary) {
      console.error("No summary found in the response.");
      return;
    }

    console.log("📄 Summary:\n", summary);
  } catch (error) {
    console.error("Request failed:", error);
  }
}

summarizeArticle(articleText);
