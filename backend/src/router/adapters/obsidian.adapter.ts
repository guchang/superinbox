/**
 * Obsidian Adapter - Create markdown files in Obsidian vault
 */

import { BaseAdapter } from '../adapter.interface.js';
import type { Item, DistributionResult } from '../../types/index.js';
import { AdapterType } from '../../types/index.js';
import { logger } from '../../middleware/logger.js';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

export class ObsidianAdapter extends BaseAdapter {
  readonly type: AdapterType = AdapterType.OBSIDIAN;
  readonly name = 'Obsidian Adapter';

  /**
   * Validate Obsidian configuration
   */
  validate(config: Record<string, unknown>): boolean {
    return (
      typeof config.vaultPath === 'string' &&
      config.vaultPath.length > 0
    );
  }

  /**
   * Distribute item to Obsidian vault
   */
  async distribute(item: Item): Promise<DistributionResult> {
    this.ensureInitialized();

    const vaultPath = this.config.vaultPath as string;
    const subfolder = (this.config.subfolder as string) ?? 'Inbox';
    const createFolders = (this.config.createFolders as boolean) ?? true;

    try {
      // Build target directory
      const targetDir = join(vaultPath, subfolder);

      // Create directory if needed
      if (!existsSync(targetDir) && createFolders) {
        mkdirSync(targetDir, { recursive: true });
        logger.info(`Created directory: ${targetDir}`);
      }

      // Generate filename
      const filename = this.generateFilename(item);
      const filepath = join(targetDir, filename);

      // Generate content
      const content = this.generateContent(item);

      // Write file
      writeFileSync(filepath, content, 'utf-8');

      logger.info(`Created Obsidian file: ${filepath}`);

      return this.createResult('obsidian-vault', 'success', {
        externalId: filepath,
        externalUrl: `obsidian://open?vault=${encodeURIComponent(vaultPath)}&file=${encodeURIComponent(filename)}`
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Obsidian adapter error: ${errorMessage}`);
      return this.createResult('obsidian-vault', 'failed', {
        error: errorMessage
      });
    }
  }

  /**
   * Generate filename for the item
   */
  private generateFilename(item: Item): string {
    // Use suggested title or generate from content
    let title = item.suggestedTitle ?? item.originalContent.substring(0, 30);

    // Clean filename: remove invalid characters
    title = title
      .replace(/[<>:"/\\|?*]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    // Add date prefix if configured
    if (this.config.datePrefix !== false) {
      const date = new Date().toISOString().split('T')[0];
      return `${date} - ${title}.md`;
    }

    return `${title}.md`;
  }

  /**
   * Generate markdown content for the item
   */
  private generateContent(item: Item): string {
    const lines: string[] = [];

    // Frontmatter
    lines.push('---');
    lines.push(`created: ${item.createdAt.toISOString()}`);
    lines.push(`category: ${item.category}`);
    lines.push(`status: ${item.status}`);
    lines.push(`source: ${item.source}`);

    if (item.entities.tags && item.entities.tags.length > 0) {
      lines.push(`tags: [${item.entities.tags.join(', ')}]`);
    }

    if (item.entities.dueDate) {
      lines.push(`due_date: ${item.entities.dueDate.toISOString()}`);
    }

    if (item.entities.amount) {
      lines.push(`amount: ${item.entities.amount} ${item.entities.currency ?? ''}`);
    }

    lines.push('---');
    lines.push('');

    // Title
    if (item.suggestedTitle) {
      lines.push(`# ${item.suggestedTitle}`);
      lines.push('');
    }

    // Summary
    if (item.summary) {
      lines.push(`> ${item.summary}`);
      lines.push('');
    }

    // Original content
    lines.push('## Content');
    lines.push('');
    lines.push(item.originalContent);
    lines.push('');

    // Metadata section
    const hasMetadata =
      item.entities.dates ||
      item.entities.people ||
      item.entities.location ||
      item.entities.urls;

    if (hasMetadata) {
      lines.push('## Details');
      lines.push('');

      if (item.entities.dates && item.entities.dates.length > 0) {
        lines.push(`**Dates:** ${item.entities.dates.join(', ')}`);
        lines.push('');
      }

      if (item.entities.people && item.entities.people.length > 0) {
        lines.push(`**People:** ${item.entities.people.join(', ')}`);
        lines.push('');
      }

      if (item.entities.location) {
        lines.push(`**Location:** ${item.entities.location}`);
        lines.push('');
      }

      if (item.entities.urls && item.entities.urls.length > 0) {
        lines.push('**Links:**');
        item.entities.urls.forEach(url => {
          lines.push(`- ${url}`);
        });
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  /**
   * Health check for Obsidian
   */
  async healthCheck(): Promise<boolean> {
    try {
      this.ensureInitialized();
      const vaultPath = this.config.vaultPath as string;
      return existsSync(vaultPath);
    } catch {
      return false;
    }
  }
}

export const obsidianAdapter = new ObsidianAdapter();
