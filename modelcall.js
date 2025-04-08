// modelcall.js
// Centralized module for API calls to OpenRouter

/**
 * Makes an API call to OpenRouter with the provided prompt
 * @param {string} prompt - The prompt text to send to the model
 * @param {string|null} apiKey - Optional API key (if not provided, will be fetched from storage)
 * @returns {Promise} - Promise resolving to the API response
 */
export async function callModel(prompt, apiKey = null) {
  return new Promise((resolve, reject) => {
    // If API key is not provided, fetch from storage
    if (!apiKey) {
      chrome.storage.sync.get(["apiKey"], async function(result) {
        if (result.apiKey) {
          performApiCall(prompt, result.apiKey, resolve, reject);
        } else {
          reject({ error: "No API key available", success: false });
        }
      });
    } else {
      // If API key is provided directly, use it
      performApiCall(prompt, apiKey, resolve, reject);
    }
  });
}

/**
 * Internal function to perform the actual API call
 * @private
 */
function performApiCall(prompt, apiKey, resolve, reject) {
  const endpoint = "https://openrouter.ai/api/v1/chat/completions";
  
  fetch(endpoint, {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
      "HTTP-Referer": "anki-card-creator",
      "X-Title": "Anki Card Creator"
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-pro-exp-03-25:free",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: prompt
            }
          ]
        }
      ]
    }),
  })
  .then(response => response.json())
  .then(data => {
    if (data.error) {
      console.error("API Error:", data.error);
      reject({ error: data.error.message || "API error occurred", success: false });
      return;
    }

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      console.error("No content found in API response");
      reject({ error: "No content found in response", success: false });
      return;
    }

    console.log("✅ API call successful");
    resolve({ content, success: true, rawResponse: data });
  })
  .catch(error => {
    console.error("API request failed:", error);
    reject({ error: error.message || "Request failed", success: false });
  });
}