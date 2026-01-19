/**
 * Add Command - Send content to inbox
 */

import chalk from 'chalk';
import ora, { Ora } from 'ora';
import { api } from '../api/client.js';
import { display } from '../utils/display.js';
import { requireAuth } from '../utils/auth-check.js';
import type { CliOptions } from '../types/index.js';

export async function add(content: string, options: CliOptions = {}): Promise<void> {
  try {
    await requireAuth();

    const spinner = ora('Sending to inbox...').start();

    let result;

    // Handle file upload
    if (options.file) {
      result = await api.uploadFile(options.file, {
        content: content || undefined,
        source: options.source
      });
      spinner.succeed('File uploaded');
    } else {
      // Create item
      result = await api.createItem(content, {
        type: options.type,
        source: options.source
      });
      spinner.succeed('Item created');
    }

    // Show result
    display.success(`Created item ${chalk.cyan(result.id)}`);
    console.log(chalk.gray(`  Status: ${result.status}`));
    console.log(chalk.gray(`  Category: ${result.category}`));

    // Wait for AI processing if requested
    if (options.wait) {
      await waitForProcessing(result.id, spinner);
    }

  } catch (error) {
    display.error(error instanceof Error ? error.message : 'Failed to create item');
    process.exit(1);
  }
}

/**
 * Wait for AI processing to complete
 */
async function waitForProcessing(itemId: string, spinner: Ora | null): Promise<void> {
  if (spinner) spinner = ora('Waiting for AI processing...').start();

  const maxAttempts = 30;
  let attempts = 0;

  while (attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 1000));

    try {
      const item = await api.getItem(itemId);

      if (item.status === 'completed') {
        if (spinner) spinner!.succeed('AI processing complete');
        display.item(item);
        return;
      }

      if (item.status === 'failed') {
        if (spinner) spinner!.fail('AI processing failed');
        return;
      }

      attempts++;
    } catch {
      attempts++;
    }
  }

  if (spinner) spinner!.warn('AI processing timeout');
}
