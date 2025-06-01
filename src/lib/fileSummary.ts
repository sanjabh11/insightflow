// Version 1.2: Modular utility for summarizing file content by path.
// This module allows backend or logic layers to fetch and summarize file contents directly.
// No UI or CSS changes. Follows modular_coding_rule and is versioned for rollback.

import fs from 'fs/promises';
import path from 'path';

/**
 * Summarize a file by returning the top N non-empty lines or a basic summary.
 * Only supports text-based files (e.g., .env, .md, .json, .txt, .js, .ts, .csv).
 * @param filePath Absolute or relative path to the file.
 * @param topN Number of key lines to return (default: 5)
 * @returns Promise<string[]> Array of top N lines or summary items.
 */
export async function summarizeFile(filePath: string, topN: number = 5): Promise<string[]> {
  try {
    const ext = path.extname(filePath).toLowerCase();
    const base = path.basename(filePath).toLowerCase();
    const textTypes = ['.env', '.md', '.json', '.txt', '.js', '.ts', '.csv', '.log', '.config'];
    const supportedFiles = ['.env', '.gitignore', '.dockerignore', '.npmrc', '.yarnrc'];
    if (!textTypes.includes(ext) && !supportedFiles.includes(base)) {
      return [`Unsupported file type: ${ext || base}`];
    }
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    if (lines.length === 0) return ['File is empty or contains no readable lines.'];
    return lines.slice(0, topN);
  } catch (err: any) {
    return [`Error reading file: ${err.message}`];
  }
}

// Example usage (for test/dev):
// summarizeFile('./.env').then(console.log);
