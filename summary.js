require("dotenv").config();
const API_KEY = "AIzaSyDu2BsZ_nzDi6AaO_yBnL0SMpZDxSWd0TM";
const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;

async function cleanupText(text) {
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `Extract and clean the main content from this webpage text. Keep only the important information including title, main body, and key points. Remove navigation elements, ads, footers, and other non-essential content:\n\n${text}`,
              },
            ],
          },
        ],
      }),
    });

    const data = await response.json();
    if (data.error) {
      console.error("API Error:", data.error);
      return { error: data.error.message, success: false };
    }

    const cleanedText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!cleanedText) {
      console.error("No cleaned text found in the response.");
      return { error: "No cleaned text found in response", success: false };
    }

    console.log("✨ Text cleaned successfully");
    return { content: cleanedText, success: true };
  } catch (error) {
    console.error("Text cleanup request failed:", error);
    return { error: error.message, success: false };
  }
}

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
      return { error: data.error.message, success: false };
    }

    const summary = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!summary) {
      console.error("No summary found in the response.");
      return { error: "No summary found in response", success: false };
    }

    console.log("📄 Summary created successfully");
    return { content: summary, success: true };
  } catch (error) {
    console.error("Summarization request failed:", error);
    return { error: error.message, success: false };
  }
}

// Export functions for use in extension
if (typeof module !== 'undefined') {
  module.exports = {
    cleanupText,
    summarizeArticle
  };
}