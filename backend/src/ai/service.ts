/**
 * AI Service - High-level AI processing orchestration
 */

import { getLLMClient } from './llm-client.js';
import { IntentClassifier } from './intent-classifier.js';
import type { AIAnalysisResult } from '../types/index.js';
import { ContentType } from '../types/index.js';

export class AIService {
  private intentClassifier: IntentClassifier;

  constructor() {
    const llm = getLLMClient();
    this.intentClassifier = new IntentClassifier(llm);
  }

  /**
   * Analyze content and return AI insights
   */
  async analyzeContent(content: string, contentType: ContentType = ContentType.TEXT): Promise<AIAnalysisResult> {
    return this.intentClassifier.analyze(content, contentType);
  }

  /**
   * Generate summary for content
   */
  async generateSummary(content: string, maxLength = 100): Promise<string> {
    const llm = getLLMClient();

    const prompt = `请为以下内容生成一个简短摘要（不超过 ${maxLength} 字）：

${content}

摘要：`;

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
   * Classify intent (standalone)
   */
  async classifyIntent(content: string): Promise<{ intent: string; confidence: number }> {
    const result = await this.analyzeContent(content);
    return {
      intent: result.intent,
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
