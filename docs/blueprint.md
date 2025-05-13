# **App Name**: InsightFlow

## Core Features:

- File Upload & Management: Enable users to upload files one at a time with clear feedback on successful uploads or errors, supporting CSV, DOCX, PDF, images, and audio.
- AI-Powered Content Analysis: Analyze the content of uploaded files using AI, enabling the tool to understand and answer questions based on the file's data, text, image, or transcribed audio content. This also involves extracting tabular data, identifying objects in images, transcribing audio, and more. The LLM will use reasoning to decide when or if to incorporate some piece of information in its output. This LLM should also be able to answer general knowledge questions, even when no file has been uploaded.
- Versatile Q&A Interface: Provide both text and live audio input options for users to ask questions, along with clear text and live audio output for receiving answers.
- Intelligent Web Search Integration: When an answer isn't found within the uploaded file, the tool will use web search to find potential publicly available datasets and sources that match the query. The LLM will use reasoning to decide when or if to incorporate some piece of information in its output. Sources should be cited whenever possible. Additionally, the tool will be able to answer general knowledge questions even when no file has been uploaded.
- Data Visualization: Visualize the data with column distribution plots and correlation matrices

## Style Guidelines:

- Primary color: Teal (#008080) to convey a sense of clarity and intelligence.
- Secondary color: Light gray (#D3D3D3) to create a clean and modern look.
- Accent: Purple (#800080) for interactive elements and data visualizations, adding a touch of creativity.
- Clean and modern font for easy readability.
- Use minimalist icons to represent file types and actions.
- Ensure a clear, intuitive layout with distinct sections for file upload, query input, and answer display.
- Subtle animations for loading states and transitions to enhance user experience.