# Product Requirements Document (PRD): InsightFlow

**Version:** 1.5  
**Date:** June 26, 2025  
**Author:** Gemini (AI Assistant)

---

## 1. Introduction & Overview
InsightFlow is an AI-powered web application that allows users to upload and analyze various file types (CSV, DOCX, PDF, images, audio) and ask questions about their content via text or live audio. The system leverages a multimodal LLM, web search, and real-time audio processing to provide insightful answers and data visualizations. Designed for students and researchers, the platform prioritizes cost-effective, browser-first architecture.

---

## 2. Goals and Objectives
- Enable users to upload files and receive instant, AI-powered insights.
- Support text and audio Q&A, with fallback to web search if file content is insufficient.
- Visualize tabular data (distribution plots, correlation matrices).
- Prioritize a modern, accessible, and intuitive user experience.

---

## 3. User Stories
- **As a student**, I want to upload a PDF or CSV and ask questions about its content so I can quickly extract insights for my research.
- **As a researcher**, I want to transcribe audio interviews and query them for key points.
- **As a user**, I want to ask questions via voice and receive spoken answers.
- **As a user**, I want to see visualizations of tabular data for better understanding.
- **As a developer**, I want clear feedback and error messages during upload and analysis.

---

## 4. Functional Requirements
### 4.1 File Upload & Management
- Upload one file at a time (CSV, DOCX, PDF, JPG/JPEG, MP3/WAV; max 60MB).
- Clear feedback on upload success or error (type/size/format).

### 4.2 Content Analysis & Processing
- Detect file type and process accordingly:
  - **CSV:** Extract/visualize tabular data; support queries on rows, columns, aggregations.
  - **DOCX:** Extract text; support Q&A on content.
  - **PDF:** Modular handling (plain, financial, scanned, encrypted); extract text and metadata; robust fallback.
  - **Image:** OCR via Tesseract.js; describe and answer questions about image content.
  - **Audio:** Transcribe to text; answer Q&A on transcript.

### 4.3 Q&A Interface
- Text and live audio input for queries.
- LLM interprets queries in context of uploaded file.
- Answers shown as text and spoken aloud.
- If file content is insufficient, perform web search and cite sources.

### 4.4 Dataset Discovery
- User can search for relevant datasets via text query.
- System presents dataset links from web search.

### 4.5 Data Visualization
- Visualize column distributions and correlation matrices for tabular data.

### 4.6 Audio & Language Features
- Modular voice selection (gender/language grouping: English/Hindi).
- Fallback to best available voice if preferred not found.
- All audio features modular for extensibility.

---

## 5. Non-Functional Requirements
- **Performance:** Low latency for audio Q&A (<2-3s), file processing (<30s typical).
- **Usability:** Intuitive, accessible, clear error guidance.
- **Scalability:** Browser-first, but architecture supports backend extension.
- **Security:** API keys protected, no sensitive user data stored.
- **Cost:** Leverage free/hobbyist tiers, prevent runaway API costs.
- **Reliability:** Graceful error handling, robust PDF/image/audio processing.

---

## 6. System Architecture

### 6.1 Frontend-Only (Recommended for V1)
- **Frontend:** Next.js (React), Tailwind CSS
- **AI/LLM:** Google Gemini API (via browser or backend proxy)
- **Web Search:** Google Custom Search API or Firecrawl
- **OCR:** Tesseract.js (via Node.js microservice `ocr-server.js`)
- **Audio:** Web Speech API
- **Visualization:** Recharts
- **State:** Browser localStorage/sessionStorage

#### Diagram
```
[User] ⇄ [Next.js Frontend] ⇄ [Browser APIs / OCR Microservice]
        ⇄ [Google Gemini API / Web Search API]
```

### 6.2 Backend-Extended (Optional/Future)
- Add Node.js backend for secure API key handling, large file processing, advanced features.

---

## 7. Table/Configuration Details
- **.env:** Stores API keys (Gemini, Google Search, etc.), PORT=3001 for dev server.
- **ocr-server.js:** Standalone Node.js OCR microservice (Tesseract.js, runs on 4001).
- **netlify.toml / windsurf_deployment.yaml:** Deployment configs.
- **package.json:** Lists all dependencies (see for details).

---

## 8. Developer Notes & Future Improvements
- Modular codebase: add new file types, voices, or analytics easily.
- All Q&A and audio logic is encapsulated in modular hooks/components.
- Add user authentication/history in future versions.
- Expand language/voice support and analytics.
- Consider backend for secure API handling and advanced analytics.
- See also: `docs/blueprint.md` and `docs/prd_modified.txt` for more detail.

---

## 9. References
- [blueprint.md](docs/blueprint.md): Core features & style guidelines
- [prd_modified.txt](docs/prd_modified.txt): Full requirements & architecture
- [README.md](README.md): User/developer guide
