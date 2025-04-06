# Anki Card Creator

A Chrome extension that extracts content from web pages and automatically creates Anki flashcards.

Created by Michael, Philip, Vincent, and Weston for DiamondHacks 2025.

## Features

- Extract and clean content from any web page
- Generate high-quality flashcards with AI
- Support for PDF documents
- Save and manage highlights across websites
- Direct export to Anki decks
- Download flashcards as CSV files

## Installation

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top-right corner
4. Click "Load unpacked" and select the extension directory
5. The extension icon should appear in your Chrome toolbar

## Usage

1. Navigate to any web page with content you want to learn
2. Click the extension icon in your Chrome toolbar
3. Enter your API key (required for AI-powered flashcard generation)
4. Choose your preferred options
5. Click one of the generation buttons:
   - "Extract & Generate from Article" - processes the entire article
   - "Generate Cards from Highlights" - processes only text you've highlighted

After generation, you can:
- View and flip through the generated flashcards in the popup
- Download the flashcards as a CSV file
- Send the flashcards directly to Anki (see setup below)

## Anki Integration Setup

To enable direct export to Anki decks:

1. **Install Anki**: Download and install [Anki](https://apps.ankiweb.net/) if you haven't already.

2. **Install AnkiConnect add-on**:
   - Open Anki
   - Go to Tools → Add-ons → Get Add-ons...
   - Enter the code: `2055492159`
   - Click "OK" and restart Anki when prompted

3. **Using the Anki integration**:
   - Make sure Anki is running before using the extension
   - Select your target Anki deck from the dropdown in the extension popup
   - Generate flashcards as usual
   - Click "Send to Anki" instead of downloading the CSV
   - The cards will be added directly to your selected Anki deck

**Note**: Anki must be running for the direct export feature to work.