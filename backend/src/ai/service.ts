/**
 * AI Service - High-level AI processing orchestration
 */

import { getLLMClient } from './llm-client.js';
import { CategoryClassifier } from './category-classifier.js';
import type { AIAnalysisResult } from '../types/index.js';
import { ContentType } from '../types/index.js';

export class AIService {
  private categoryClassifier: CategoryClassifier;

  constructor() {
    const llm = getLLMClient();
    this.categoryClassifier = new CategoryClassifier(llm);
  }

  /**
   * Analyze content and return AI insights
   */
  async analyzeContent(content: string, contentType: ContentType = ContentType.TEXT): Promise<AIAnalysisResult> {
    return this.categoryClassifier.analyze(content, contentType);
  }

  /**
   * Generate summary for content
   */
  async generateSummary(content: string, maxLength = 100): Promise<string> {
    const llm = getLLMClient();

    const prompt = `Please generate a brief summary for the following content (no more than ${maxLength} characters):

${content}

Summary:`;

    const summary = await llm.complete(prompt);
    return summary.trim().substring(0, maxLength);
  }

  /**
   * Extract entities from content (standalone)
   */
  async extractEntities(content: string): Promise<AIAnalysisResult['entities']> {
    const result = await this.analyzeContent(content);
    return result.entities;
  }

  /**
   * Classify category (standalone)
   */
  async classifyCategory(content: string): Promise<{ category: string; confidence: number }> {
    const result = await this.analyzeContent(content);
    return {
      category: result.category,
      confidence: result.confidence
    };
  }

  /**
   * Health check for AI service
   */
  async healthCheck(): Promise<boolean> {
    const llm = getLLMClient();
    return llm.healthCheck();
  }
}

// Singleton instance
let aiServiceInstance: AIService | null = null;

export const getAIService = (): AIService => {
  if (!aiServiceInstance) {
    aiServiceInstance = new AIService();
  }
  return aiServiceInstance;
};
