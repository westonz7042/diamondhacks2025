// summary.js
import { callModel } from "./modelcall.js";

export async function summarizeArticle(text, userPreference) {
  try {
    const prompt = `Summarize this with main ideas:${
      userPreference ? userPreference : ""
    }\n\n${text}`;

    const response = await callModel(prompt);
    
    if (!response.success) {
      return { error: response.error, success: false };
    }
    
    console.log(userPreference);
    console.log("📄 Summary created successfully");
    return { content: response.content, success: true };
  } catch (error) {
    console.error("Summarization request failed:", error);
    return { error: error.message, success: false };
  }
}