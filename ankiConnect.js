// ankiConnect.js
// This module handles communication with the AnkiConnect API

// The base URL for AnkiConnect
const ANKI_CONNECT_URL = "http://localhost:8765";

/**
 * Invoke an AnkiConnect API action
 * @param {string} action - The action to perform
 * @param {Object} params - The parameters for the action
 * @returns {Promise} - A promise that resolves with the result of the action
 */
export async function invokeAnkiConnect(action, params = {}) {
  const response = await fetch(ANKI_CONNECT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: action,
      version: 6, // AnkiConnect API version
      params: params,
    }),
  });

  const responseJson = await response.json();
  
  if (responseJson.error) {
    throw new Error(`AnkiConnect error: ${responseJson.error}`);
  }
  
  return responseJson.result;
}

/**
 * Check if AnkiConnect is available
 * @returns {Promise<boolean>} - A promise that resolves with true if AnkiConnect is available
 */
export async function isAnkiConnectAvailable() {
  try {
    // Request version to see if AnkiConnect is available
    const version = await invokeAnkiConnect("version");
    return version >= 6; // AnkiConnect API version we support
  } catch (error) {
    console.error("AnkiConnect not available:", error);
    return false;
  }
}

/**
 * Get a list of all available decks
 * @returns {Promise<string[]>} - A promise that resolves with an array of deck names
 */
export async function getDecks() {
  return invokeAnkiConnect("deckNames");
}

/**
 * Get a list of available note types (models)
 * @returns {Promise<string[]>} - A promise that resolves with an array of note type names
 */
export async function getNoteTypes() {
  return invokeAnkiConnect("modelNames"); 
}

/**
 * Get the field names for a specific note type
 * @param {string} modelName - The name of the note type
 * @returns {Promise<string[]>} - A promise that resolves with an array of field names
 */
export async function getFieldNames(modelName) {
  return invokeAnkiConnect("modelFieldNames", { modelName });
}

/**
 * Add multiple notes to Anki
 * @param {Array} flashcards - Array of flashcard objects with front and back properties
 * @param {string} deckName - The name of the deck to add the notes to
 * @param {string} modelName - The name of the note type to use
 * @param {boolean} allowDuplicates - Whether to allow duplicate notes (default: false)
 * @returns {Promise<number[]>} - A promise that resolves with an array of note IDs
 */
export async function addFlashcards(flashcards, deckName, modelName = "Basic", allowDuplicates = false) {
  // Prepare the notes array
  const notes = flashcards.map(card => ({
    deckName: deckName,
    modelName: modelName,
    fields: {
      Front: card.front,
      Back: card.back
    },
    options: {
      allowDuplicate: allowDuplicates,
      duplicateScope: "deck"
    },
    tags: ["anki-card-creator"]
  }));

  // Add the notes to Anki
  return invokeAnkiConnect("addNotes", { notes });
}

/**
 * Sync Anki after adding notes
 * @returns {Promise<null>} - A promise that resolves when the sync is complete
 */
export async function syncAnki() {
  return invokeAnkiConnect("sync");
}