/**
 * InsightFlow API Route - /api/ask
 * Version 1.9: Modular API endpoint for handling AI queries
 * 
 * This file implements a proper Next.js API route that securely handles:
 * - Environment variable validation
 * - Error handling and logging
 * - Request validation
 * - Response formatting
 * - Integration with Genkit/GoogleAI
 */

import { NextResponse } from 'next/server';
import { ai } from '@/ai/genkit';

// Type definitions
type ApiRequest = {
  question: string;
  fileDataUri?: string;
  fileType?: string;
  requiresWebSearch?: boolean;
};

type ApiResponse = {
  answer: string;
  sources: string[];
  requiresWebSearch: boolean;
  requiresImageGeneration: boolean;
  imageGenerationPrompt?: string;
  error?: string;
};

/**
 * Validates the environment and returns any missing variables
 */
function validateEnvironment(): string[] {
  const missingVars = [];
  
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY.trim() === '') {
    missingVars.push('GEMINI_API_KEY');
  }
  
  return missingVars;
}

/**
 * Validates the request body and returns any validation errors
 */
function validateRequest(data: any): string[] {
  const errors = [];
  
  if (!data) {
    errors.push('Request body is missing');
    return errors;
  }
  
  if (!data.question || typeof data.question !== 'string' || data.question.trim() === '') {
    errors.push('Question is required and must be a non-empty string');
  }
  
  return errors;
}

/**
 * Handles errors in a consistent way for logging and client response
 */
function handleError(error: unknown): { message: string, status: number } {
  console.error('[API Error]', error);
  
  if (error instanceof Error) {
    // Return a sanitized error message
    return { 
      message: `Error processing request: ${error.message}`, 
      status: 500 
    };
  }
  
  return { 
    message: 'An unknown error occurred', 
    status: 500 
  };
}

/**
 * Main POST handler for the /api/ask endpoint
 */
export async function POST(request: Request) {
  // 1. Validate environment variables
  const missingVars = validateEnvironment();
  if (missingVars.length > 0) {
    console.error(`[API Error] Missing environment variables: ${missingVars.join(', ')}`);
    return NextResponse.json(
      { error: `Server configuration error: Missing ${missingVars.join(', ')}` },
      { status: 500 }
    );
  }
  
  // 2. Check if Genkit/GoogleAI is properly initialized
  if (!ai) {
    console.error('[API Error] Genkit/GoogleAI client is not initialized');
    return NextResponse.json(
      { error: 'AI service is not available' },
      { status: 503 }
    );
  }
  
  try {
    // 3. Parse and validate request
    const data: ApiRequest = await request.json();
    const validationErrors = validateRequest(data);
    
    if (validationErrors.length > 0) {
      return NextResponse.json(
        { error: `Validation error: ${validationErrors.join(', ')}` },
        { status: 400 }
      );
    }
    
    const { question, fileDataUri, fileType, requiresWebSearch = false } = data;
    
    // 4. File size limit (30MB for dataUri)
    if (fileDataUri && fileDataUri.length > 30_000_000) {
      return NextResponse.json({ error: "File too large. Please upload a file smaller than 30MB." }, { status: 413 });
    }
    
    // 5. Prepare context for the AI model based on file type
    let context = '';
    if (fileDataUri && fileType) {
      try {
        if (fileType.includes('text') || fileType.includes('csv')) {
          // Text/CSV: decode base64
          const base64Data = fileDataUri.split(',')[1];
          const textContent = Buffer.from(base64Data, 'base64').toString('utf-8');
          context = `File content: ${textContent.substring(0, 10000)}`;
        } else if (fileType.includes('image')) {
          context = 'User uploaded an image. (Image content not shown here for brevity)';
        } else if (fileType.includes('audio')) {
          context = 'User uploaded an audio file. (Audio content not shown here for brevity)';
        } else if (fileType.includes('pdf')) {
          context = 'User uploaded a PDF file. (PDF content not shown here for brevity)';
        } else if (fileType.includes('officedocument')) {
          context = 'User uploaded a DOCX file. (DOCX content not shown here for brevity)';
        } else {
          context = 'User uploaded a file of unknown type.';
        }
      } catch (err) {
        console.warn('[API Warning] Could not parse file data', err);
      }
    }
    
    // 6. Web search integration placeholder
    if (requiresWebSearch) {
      // TODO: Integrate real web search here
      return NextResponse.json({
        answer: 'Web search is not yet implemented in this API. Please try again later.',
        sources: ['web'],
        requiresWebSearch: true,
        requiresImageGeneration: false,
      });
    }
    
    // 7. Call the AI model with the question and context
    const promptText = `
      Question: ${question}
      ${context ? `\nContext: ${context}` : ''}
      Provide a detailed, accurate answer based on the information available.
    `;
    
    const response = await ai.generate(promptText);
    
    // 8. Format and return the response
    const answer = response.text ? response.text.trim() : String(response).trim();
    
    const apiResponse: ApiResponse = {
      answer,
      sources: [],
      requiresWebSearch: false,
      requiresImageGeneration: false,
    };
    
    return NextResponse.json(apiResponse);
    
  } catch (error) {
    // 9. Handle and log any errors
    const { message, status } = handleError(error);
    return NextResponse.json({ error: message }, { status });
  }
}

/**
 * GET handler for the /api/ask endpoint - can be used for health checks
 */
export async function GET() {
  return NextResponse.json({ status: 'ok', message: 'API is running' });
}
