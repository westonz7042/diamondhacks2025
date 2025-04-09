//flashcard.js
import { callModel } from "./modelcall.js";

export async function generateFlashcards(text, userPreference) {
  try {
    const prompt = `
      CRITICAL INSTRUCTION: You MUST respond with ONLY a valid JSON array of objects. No prose, explanations, or labels before or after the JSON. 
      
      Format requirements:
      1. Response MUST be a single valid JSON array of objects
      2. Each object MUST have exactly two fields: "front" and "back"
      3. Each "front" field contains a question
      4. Each "back" field contains the answer
      5. DO NOT include any markdown formatting (no \`\`\`json, no \`\`\` at start or end)
      6. DO NOT include any explanation text before or after the JSON
      7. JSON should start with [ and end with ]
      
      Example of EXACTLY how your response should be formatted:
      [{"front":"What is photosynthesis?","back":"The process by which plants convert light energy into chemical energy"},{"front":"Who wrote Hamlet?","back":"William Shakespeare"}]
      
      This is primary:
      ${userPreference ? userPreference : ""}
      
      What comes next is secondary:
      • Each card must focus on ONE specific concept (atomic knowledge)
      • Questions should be precise and unambiguous about what they're asking
      • Answers must be EXTREMELY concise - 1-2 sentences maximum (10-25 words)
      • Focus on core concepts, relationships, and techniques rather than trivia
      • Avoid yes/no questions or questions with binary answers
      • When referencing authors, use specific names instead of "the author"
      • Questions should require genuine recall, not just recognition
      • Do not provide any HTML syntax
      
      Consider these knowledge types:
      • For facts: Break complex facts into atomic units
      • For concepts: Address attributes, similarities/differences, and significance
      • For procedures: Focus on decision points and critical parameters
      
      Article:
      \n\n${text}
      
      REMEMBER: Your entire response MUST be ONLY a valid JSON array of objects with "front" and "back" fields, nothing else.
    `;

    const response = await callModel(prompt);
    if (!response.success) {
      throw new Error(response.error || "Failed to generate flashcards");
    }

    let cleanOutput = response.content.trim();
    
    // Remove any markdown code blocks if present
    cleanOutput = cleanOutput.replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
    
    // Remove any explanatory text before the JSON array
    const jsonStartIndex = cleanOutput.indexOf('[');
    const jsonEndIndex = cleanOutput.lastIndexOf(']') + 1;
    
    if (jsonStartIndex >= 0 && jsonEndIndex > jsonStartIndex) {
      cleanOutput = cleanOutput.substring(jsonStartIndex, jsonEndIndex);
    }
    
    // Additional safety check to ensure we have valid JSON
    try {
      JSON.parse(cleanOutput); // This will throw if invalid
      return cleanOutput;
    } catch (error) {
      console.error("Invalid JSON response:", cleanOutput);
      throw new Error("The API returned an invalid JSON response. Please try again.");
    }
  } catch (error) {
    console.error("Request failed:", error);
    throw error;
  }
}