import { test, expect } from '@playwright/test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MarkdownContent } from '../src/components/shared/markdown-content';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/v1';

test.describe('API Keys Authentication', () => {
  let authToken: string;
  let apiKey: string;

  test.beforeAll(async () => {
    // Register a test user and get auth token
    const registerResponse = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'playwright_test',
        email: 'playwright@test.com',
        password: 'test123456'
      })
    });

    if (registerResponse.ok) {
      const data = await registerResponse.json();
      authToken = data.data.token;
    } else {
      // User already exists, login instead
      const loginResponse = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'playwright_test',
          password: 'test123456'
        })
      });
      const data = await loginResponse.json();
      authToken = data.data.token;
    }
  });

  test('should create a new API key', async () => {
    const response = await fetch(`${BASE_URL}/api-keys`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        name: 'Playwright Test Key',
        scopes: ['inbox:read', 'inbox:write']
      })
    });

    console.log('Create API Key Response Status:', response.status);
    console.log('Create API Key Response Headers:', Object.fromEntries(response.headers.entries()));

    const responseText = await response.text();
    console.log('Create API Key Response Body:', responseText);

    expect(response.status).toBe(201);

    const data = JSON.parse(responseText);
    expect(data.success).toBe(true);
    expect(data.data.apiKey).toBeDefined();
    expect(data.data.apiKey).toMatch(/^sinbox_[A-Za-z0-9_-]+$/);
    expect(data.data.name).toBe('Playwright Test Key');
    expect(data.data.scopes).toEqual(['inbox:read', 'inbox:write']);

    apiKey = data.data.apiKey;
  });

  test('should list all API keys', async () => {
    const response = await fetch(`${BASE_URL}/api-keys`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    console.log('List API Keys Response Status:', response.status);
    const responseText = await response.text();
    console.log('List API Keys Response Body:', responseText);

    expect(response.status).toBe(200);

    const data = JSON.parse(responseText);
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data)).toBe(true);

    console.log('API Keys count:', data.data.length);

    if (data.data.length > 0) {
      // Should not expose full API key in list
      expect(data.data[0].apiKey).toBeUndefined();
      expect(data.data[0].keyPreview).toBeDefined();
    }
  });

  test('should authenticate using API key', async () => {
    const response = await fetch(`${BASE_URL}/inbox`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        content: 'Test API Key authentication from Playwright',
        source: 'playwright-test'
      })
    });

    console.log('API Key Auth Response Status:', response.status);
    const responseText = await response.text();
    console.log('API Key Auth Response Body:', responseText);

    expect(response.status).toBe(201);

    const data = JSON.parse(responseText);
    expect(data.success).toBe(true);
    expect(data.data.id).toBeDefined();
  });

  test('should update lastUsedAt timestamp', async () => {
    // Wait a bit to ensure timestamp is different
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Make another request with API key
    await fetch(`${BASE_URL}/inbox`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        content: 'Update timestamp test',
        source: 'playwright-test'
      })
    });

    // Check API key details
    const response = await fetch(`${BASE_URL}/api-keys`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    const data = await response.json();
    const testKey = data.data.find((k: any) => k.name === 'Playwright Test Key');

    expect(testKey).toBeDefined();
    expect(testKey.lastUsedAt).not.toBeNull();
    expect(testKey.lastUsedAt).not.toBeUndefined();
  });
});

test.describe('Markdown rendering (pure)', () => {
  test('should render GFM task list and table', async () => {
    const markdown = [
      '# Demo',
      '',
      '- [x] done',
      '- [ ] todo',
      '',
      '| Name | Value |',
      '| --- | --- |',
      '| A | 1 |',
    ].join('\n');

    const html = renderToStaticMarkup(
      React.createElement(MarkdownContent, { text: markdown })
    );

    expect(html).toContain('<h1>Demo</h1>');
    expect(html).toContain('<li class="task-list-item">');
    expect(html).toContain('<table>');
  });

  test('should escape html and reject unsafe markdown links', async () => {
    const markdown = [
      '<script>alert(1)</script>',
      '[x](javascript:alert(1))',
      '[safe](https://example.com)',
    ].join('\n');

    const html = renderToStaticMarkup(
      React.createElement(MarkdownContent, { text: markdown })
    );

    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('<a href="https://example.com/" target="_blank" rel="noopener noreferrer">safe</a>');
    expect(html).not.toContain('javascript:alert(1)');
  });

  test('should render inline markdown syntax in card preview content', async () => {
    const markdown = '**Bold** _Italic_ `Code`';

    const html = renderToStaticMarkup(
      React.createElement(MarkdownContent, { text: markdown })
    );

    expect(html).toContain('<strong>Bold</strong>');
    expect(html).toContain('<em>Italic</em>');
    expect(html).toContain('<code>Code</code>');
    expect(html).not.toContain('**Bold**');
  });
});
