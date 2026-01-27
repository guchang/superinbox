/**
 * AI Service - High-level AI processing orchestration
 */

import { getUserLLMClient } from './llm-client.js';
import { CategoryClassifier } from './category-classifier.js';
import { listCategories } from './store.js';
import { extractFirstUrl, fetchUrlContent } from './url-extractor.js';
import type { AIAnalysisResult } from '../types/index.js';
import { ContentType } from '../types/index.js';
import { logger } from '../middleware/logger.js';

export class AIService {
  /**
   * Analyze content and return AI insights
   */
  async analyzeContent(
    content: string,
    contentType: ContentType = ContentType.TEXT,
    options?: { userId?: string }
  ): Promise<AIAnalysisResult> {
    const preparedContent = await this.prepareContentForAnalysis(content, contentType);
    const categories = options?.userId ? listCategories(options.userId) : undefined;
    const llm = getUserLLMClient(options?.userId);
    const categoryClassifier = new CategoryClassifier(llm);
    return categoryClassifier.analyze(preparedContent, contentType, categories);
  }

  /**
   * Generate summary for content
   */
  async generateSummary(
    content: string,
    maxLength = 100,
    options?: { userId?: string }
  ): Promise<string> {
    const llm = getUserLLMClient(options?.userId);

    const prompt = `Please generate a brief summary for the following content (no more than ${maxLength} characters):

${content}

Summary:`;

    const summary = await llm.complete(prompt);
    return summary.trim().substring(0, maxLength);
  }

  /**
   * Extract entities from content (standalone)
   */
  async extractEntities(content: string, options?: { userId?: string }): Promise<AIAnalysisResult['entities']> {
    const result = await this.analyzeContent(content, ContentType.TEXT, options);
    return result.entities;
  }

  /**
   * Classify category (standalone)
   */
  async classifyCategory(
    content: string,
    options?: { userId?: string }
  ): Promise<{ category: string; confidence: number }> {
    const result = await this.analyzeContent(content, ContentType.TEXT, options);
    return {
      category: result.category,
      confidence: result.confidence
    };
  }

  /**
   * Health check for AI service
   */
  async healthCheck(options?: { userId?: string }): Promise<boolean> {
    const llm = getUserLLMClient(options?.userId);
    return llm.healthCheck();
  }

  private async prepareContentForAnalysis(content: string, contentType: ContentType): Promise<string> {
    if (contentType === ContentType.URL) {
      try {
        const urlContent = await fetchUrlContent(content);
        return this.formatUrlContent(urlContent, content);
      } catch (error) {
        logger.warn(`[AI] URL fetch failed for "${content}": ${error}`);
        return content;
      }
    }

    const embeddedUrl = extractFirstUrl(content);
    if (!embeddedUrl) {
      return content;
    }

    try {
      const urlContent = await fetchUrlContent(embeddedUrl);
      return this.formatEmbeddedUrlContent(content, urlContent, embeddedUrl);
    } catch (error) {
      logger.warn(`[AI] Embedded URL fetch failed for "${embeddedUrl}": ${error}`);
      return content;
    }
  }

  private formatUrlContent(urlContent: {
    url: string;
    title?: string;
    description?: string;
    text?: string;
  }, fallbackUrl: string): string {
    const lines: string[] = [];
    lines.push(`Source URL: ${urlContent.url || fallbackUrl}`);
    if (urlContent.title) {
      lines.push(`Title: ${urlContent.title}`);
    }
    if (urlContent.description) {
      lines.push(`Description: ${urlContent.description}`);
    }
    if (urlContent.text) {
      lines.push('Content:');
      lines.push(urlContent.text);
    } else {
      lines.push('Content: (no text extracted)');
    }
    return lines.join('\n');
  }

  private formatEmbeddedUrlContent(
    originalContent: string,
    urlContent: { url: string; title?: string; description?: string; text?: string },
    fallbackUrl: string
  ): string {
    const lines: string[] = [];
    lines.push('User text:');
    lines.push(originalContent);
    lines.push('');
    lines.push('Referenced URL content:');
    lines.push(this.formatUrlContent(urlContent, fallbackUrl));
    return lines.join('\n');
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
