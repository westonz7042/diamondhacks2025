let API_KEY = "";
// Function to create the endpoint URL with the latest API key
function getEndpoint() {
  return `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;
}

// Function to clean up text content
// async function cleanupText(text) {
//   // Get the latest API key from storage
//   return new Promise((resolve, reject) => {
//     chrome.storage.sync.get(["apiKey"], async function (result) {
//       if (result.apiKey) {
//         API_KEY = result.apiKey;
//       }

//       try {
//         const response = await fetch(getEndpoint(), {
//           method: "POST",
//           headers: { "Content-Type": "application/json" },
//           body: JSON.stringify({
//             contents: [
//               {
//                 parts: [
//                   {
//                     text: `Extract and clean the main content from this webpage text. Keep only the important information including title, main body, and key points. Remove navigation elements, ads, footers, and other non-essential content:\n\n${text}`,
//                   },
//                 ],
//               },
//             ],
//           }),
//         });

//         const data = await response.json();
//         if (data.error) {
//           console.error("API Error:", data.error);
//           reject({ error: data.error.message, success: false });
//           return;
//         }

//         const cleanedText = data.candidates?.[0]?.content?.parts?.[0]?.text;

//         if (!cleanedText) {
//           console.error("No cleaned text found in the response.");
//           reject({
//             error: "No cleaned text found in response",
//             success: false,
//           });
//           return;
//         }

//         console.log("✨ Text cleaned successfully");
//         resolve({ content: cleanedText, success: true });
//       } catch (error) {
//         console.error("Text cleanup request failed:", error);
//         reject({ error: error.message, success: false });
//       }
//     });
//   });
// }

export async function summarizeArticle(text) {
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
          reject({ error: data.error.message, success: false });
          return;
        }

        const summary = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!summary) {
          console.error("No summary found in the response.");
          reject({ error: "No summary found in response", success: false });
          return;
        }

        console.log("📄 Summary created successfully");
        resolve({ content: summary, success: true });
      } catch (error) {
        console.error("Summarization request failed:", error);
        reject({ error: error.message, success: false });
      }
    });
  });
}

// Export functions for use in extension
// For ES module support (used in popup.js)
// export { cleanupText, summarizeArticle };
