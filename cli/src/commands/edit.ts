/**
 * Edit Command - Open editor to write content
 */

import { edit as editFile } from 'external-editor';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdtempSync, writeFileSync, unlinkSync, readFileSync } from 'fs';
import { add } from './add.js';
import { display } from '../utils/display.js';

export async function edit(options: any = {}): Promise<void> {
  // Create temp file
  const tempDir = mkdtempSync(join(tmpdir(), 'sinbox-'));
  const tempFile = join(tempDir, 'message.txt');

  // Write placeholder
  writeFileSync(tempFile, '# Enter your content below\n# Lines starting with # will be ignored\n\n');

  try {
    // Open editor
    const content = editFile(tempFile);

    if (!content || content.trim().length === 0) {
      display.warning('No content provided');
      return;
    }

    // Filter out comment lines
    const lines = content.split('\n')
      .filter(line => !line.trim().startsWith('#'))
      .filter(line => line.trim().length > 0);

    if (lines.length === 0) {
      display.warning('No content provided');
      return;
    }

    const finalContent = lines.join('\n');

    // Send to inbox
    display.info('Sending content to inbox...');
    await add(finalContent, options);

  } catch (error) {
    if ((error as any).message?.includes('cancelled')) {
      display.warning('Edit cancelled');
      return;
    }

    display.error(error instanceof Error ? error.message : 'Failed to edit');
    process.exit(1);

  } finally {
    // Clean up temp file
    try {
      unlinkSync(tempFile);
    } catch {
      // Ignore
    }
  }
}
