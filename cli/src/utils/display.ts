/**
 * Display Utilities
 */

import chalk from 'chalk';
import Table from 'cli-table3';
import type { Item } from '../types/index.js';

export const display = {
  /**
   * Display success message
   */
  success(message: string): void {
    console.log(chalk.green('✓'), message);
  },

  /**
   * Display error message
   */
  error(message: string): void {
    console.error(chalk.red('✗'), message);
  },

  /**
   * Display warning message
   */
  warning(message: string): void {
    console.warn(chalk.yellow('⚠'), message);
  },

  /**
   * Display info message
   */
  info(message: string): void {
    console.log(chalk.blue('ℹ'), message);
  },

  /**
   * Display item as table
   */
  table(items: Item[], compact = false): void {
    if (items.length === 0) {
      display.info('No items found');
      return;
    }

    // Create table without complex options
    const table = new Table({
      chars: {
        top: '─',
        'top-mid': '┬',
        'top-left': '┌',
        'top-right': '┐',
        bottom: '─',
        'bottom-mid': '┴',
        'bottom-left': '└',
        'bottom-right': '┘',
        left: '│',
        'left-mid': '├',
        mid: '─',
        'right': '│',
        'right-mid': '┤',
        middle: '│'
      }
    });

    // Add header
    const head = compact
      ? ['ID', 'Category', 'Content', 'Status']
      : ['ID', 'Category', 'Content', 'Status', 'Created'];
    table.push(head);

    // Add rows
    for (const item of items) {
      const content = item.originalContent.substring(0, 35) +
        (item.originalContent.length > 35 ? '...' : '');

      const row = [
        item.id.substring(0, 8),
        colorizeCategory(item.category),
        content,
        colorizeStatus(item.status)
      ];

      if (!compact) {
        row.push(formatDate(item.createdAt));
      }

      table.push(row as any);
    }

    console.log(table.toString());
  },

  /**
   * Display item details
   */
  item(item: Item): void {
    console.log('');
    console.log(chalk.bold.white('╔════════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.white('║') + chalk.bold.white('  ') + chalk.bold.white(item.suggestedTitle ?? item.originalContent.substring(0, 30)));
    console.log(chalk.bold.white('╚════════════════════════════════════════════════════════════╝'));
    console.log('');

    console.log(chalk.gray('ID:            ') + chalk.white(item.id));
    console.log(chalk.gray('Category:      ') + colorizeCategory(item.category));
    console.log(chalk.gray('Status:        ') + colorizeStatus(item.status));
    console.log(chalk.gray('Type:          ') + chalk.white(item.contentType));
    console.log(chalk.gray('Source:        ') + chalk.white(item.source));
    console.log(chalk.gray('Created:       ') + chalk.white(formatDate(item.createdAt)));

    if (item.summary) {
      console.log('');
      console.log(chalk.gray('Summary:'));
      console.log(chalk.white('  ' + item.summary));
    }

    console.log('');
    console.log(chalk.gray('Content:'));
    console.log(chalk.white('  ' + item.originalContent));

    if (item.entities && Object.keys(item.entities).length > 0) {
      console.log('');
      console.log(chalk.gray('Extracted Entities:'));

      if (item.entities.dates?.length) {
        console.log(chalk.cyan('  Dates:        ') + chalk.white(item.entities.dates.join(', ')));
      }
      if (item.entities.dueDate) {
        console.log(chalk.cyan('  Due Date:     ') + chalk.white(item.entities.dueDate));
      }
      if (item.entities.amount) {
        console.log(chalk.cyan('  Amount:       ') + chalk.white(`${item.entities.amount} ${item.entities.currency ?? ''}`));
      }
      if (item.entities.people?.length) {
        console.log(chalk.cyan('  People:       ') + chalk.white(item.entities.people.join(', ')));
      }
      if (item.entities.location) {
        console.log(chalk.cyan('  Location:     ') + chalk.white(item.entities.location));
      }
      if (item.entities.tags?.length) {
        console.log(chalk.cyan('  Tags:         ') + chalk.white(item.entities.tags.join(', ')));
      }
    }

    console.log('');
  },
};

/**
 * Colorize category
 */
function colorizeCategory(category: string): string {
  const colors: Record<string, (text: string) => string> = {
    todo: chalk.green,
    idea: chalk.yellow,
    expense: chalk.red,
    note: chalk.blue,
    bookmark: chalk.magenta,
    schedule: chalk.cyan,
    unknown: chalk.gray
  };

  const color = colors[category] ?? chalk.white;
  return color(category);
}

/**
 * Colorize status
 */
function colorizeStatus(status: string): string {
  const colors: Record<string, (text: string) => string> = {
    pending: chalk.yellow,
    processing: chalk.blue,
    completed: chalk.green,
    failed: chalk.red,
    archived: chalk.gray
  };

  const color = colors[status] ?? chalk.white;
  return color(status);
}

/**
 * Format date
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return date.toLocaleDateString();
}

