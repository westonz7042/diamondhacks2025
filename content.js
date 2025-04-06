// content.js
console.log("Text extractor content script loaded");

// Function to extract page content
function extractPageContent() {
  try {
    // Create a clone of the document to avoid modifying the original
    const documentClone = document.cloneNode(true);

    // Parse the document with Readability
    const reader = new Readability(documentClone);
    const article = reader.parse();

    return {
      title: article.title,
      content: article.textContent,
      success: true,
    };
  } catch (error) {
    console.error("Error extracting content:", error);
    return {
      error: error.message,
      success: false,
    };
  }
}

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Content script received message:", request);

  if (request.action === "extractContent") {
    // Handle PDF check and content extraction
    checkIfPDF(request, sendResponse);
  }

  return true; // Keep the message channel open for async response
});

// Function to check if the page is a PDF and then extract the content
async function checkIfPDF(request, sendResponse) {
  try {
    const pdfStatusResponse = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: "getPDFStatus" }, resolve);
    });

    console.log("Received pdf status message: ", pdfStatusResponse);
    if (pdfStatusResponse?.isPDF) {
      const text = await extractPDFText();
      const result = { content: text };

      // Pass along the API key with the result
      if (request.apiKey) {
        result.apiKey = request.apiKey;
      }

      console.log("Extraction result (PDF):", result);
      sendResponse(result);
    } else {
      console.log("Extracting content from page");
      const result = extractPageContent();

      // Pass along the API key with the result
      if (request.apiKey) {
        result.apiKey = request.apiKey;
      }

      console.log("Extraction result (Page):", result);
      sendResponse(result);
    }
  } catch (error) {
    console.error("Error in checkIfPDF or extraction:", error);
    sendResponse({ success: false, error: error.message });
  }
}

async function extractPDFText() {
  const pdfjsLib = window["pdfjs-dist/build/pdf"];
  pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL(
    "libs/pdf.worker.min.js"
  );
  const pdfData = await fetch(window.location.href).then((res) =>
    res.arrayBuffer()
  );

  const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;

  let text = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map((item) => item.str).join(" ");
    text += pageText + "\n";
  }

  return text;
}
