# InsightFlow

**AI-Powered Multifile Analytics & Q&A Platform**

---

## Overview
InsightFlow is a modern, AI-powered web application that enables users to upload files (CSV, DOCX, PDF, images, audio), ask questions about their content (via text or live audio), and receive intelligent answers using a Large Language Model (LLM) and web search integration. The app is designed for students, researchers, and anyone needing rapid insights from diverse files—no coding required.

---

## Key Features
- **File Upload & Management:** Upload CSV, DOCX, PDF, image, and audio files (up to 60MB each).
- **AI Content Analysis:** Extracts and analyzes text, tabular, and image/audio content using AI.
- **Versatile Q&A:** Ask questions via text or live audio; receive answers in text and spoken form.
- **Web Search Integration:** If answers aren’t found in the file, InsightFlow performs a web search and cites sources.
- **Data Visualization:** View column distributions and correlation matrices for tabular data.
- **Voice & Language Selection:** Choose voice and language (English/Hindi) for audio answers.
- **Modern, Intuitive UI:** Clean layout, clear feedback, and accessibility-first design.

---

## Quick Start
1. **Clone the repository:**
   ```bash
   git clone <your-repo-url>
   cd insightflow
   ```
2. **Install dependencies:**
   ```bash
   npm install
   ```
3. **Set up environment variables:**
   - Copy `.env.example` to `.env` (if present) and set required keys (e.g., API keys for Gemini, Google Search, etc.).
   - Ensure `PORT=3001` is set for local development (see `.env`).
4. **Run the development server:**
   ```bash
   npm run dev
   # App runs at http://localhost:3001
   ```
5. **Run the OCR microservice (optional, for image OCR):**
   ```bash
   node ocr-server.js
   # Runs on http://localhost:4001
   ```

---

## Usage
- **Upload a file:** Use the upload section to select a CSV, DOCX, PDF, image, or audio file.
- **Ask questions:** Enter your query in the text box or use the microphone for live audio questions.
- **Receive answers:** Answers are shown in text and spoken aloud. If the answer isn’t in the file, a web search is performed.
- **Visualize data:** For tabular files, view distribution plots and correlation matrices.
- **Change voices/language:** Use audio controls to select preferred voice and language.

---

## Architecture
- **Frontend:** Next.js (React), Tailwind CSS, modular UI components
- **AI/LLM:** Google Gemini API (or similar)
- **Web Search:** Google Custom Search API (or Firecrawl)
- **OCR:** Tesseract.js (via `ocr-server.js` microservice)
- **Audio:** Web Speech API for speech-to-text and text-to-speech
- **Visualization:** Recharts, custom visualization components
- **State Management:** Browser localStorage/sessionStorage (no user accounts in V1)

### System Diagram
```
[User] ⇄ [Next.js Frontend] ⇄ [Browser APIs / OCR Microservice]
        ⇄ [Google Gemini API / Web Search API]
```

---

## Configuration & Environment
- `.env`: Store API keys and configuration (see `.env.example`).
- `ocr-server.js`: Standalone Node.js microservice for image OCR (requires Tesseract.js).
- `netlify.toml` / `windsurf_deployment.yaml`: Deployment configs for Netlify/Windsurf.

---

## For Developers
- **Extend file types:** Add new file handlers in `src/app` and update `FileUploadCard` logic.
- **Add Q&A logic:** Modify `analyze-uploaded-content` and `answer-with-web-search` flows in `src/ai/flows/`.
- **Improve OCR:** Enhance `ocr-server.js` for more languages or formats.
- **Add new voices/languages:** Update `useSpeech` hook and audio controls.
- **Testing:** Add tests in `/test` directory for new features.

---

## Future Improvements
- User authentication and history
- More languages and TTS voices
- Advanced analytics and charting
- Backend mode for secure API key handling
- Integration with more LLMs

---

## License
MIT (or specify your license)

## Credits
- Built with Next.js, Tesseract.js, Google Gemini API, Firecrawl, and open-source libraries.
- See `docs/blueprint.md` and `docs/prd_modified.txt` for detailed requirements and design.
