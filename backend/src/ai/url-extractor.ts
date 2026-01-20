/**
 * URL content extractor - fetches and sanitizes page text for AI analysis.
 */

import axios from 'axios';
import dns from 'dns/promises';
import net from 'net';

export interface UrlContent {
  url: string;
  title?: string;
  description?: string;
  text?: string;
}

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);
const FETCH_TIMEOUT_MS = 10000;
const MAX_BODY_BYTES = 8_000_000;
const MAX_TEXT_LENGTH = 8000;
const MAX_REDIRECTS = 5;

export const fetchUrlContent = async (rawUrl: string): Promise<UrlContent> => {
  const url = normalizeUrl(rawUrl);
  const response = await fetchWithRedirects(url);

  const contentType = String(response.headers['content-type'] ?? '').toLowerCase();
  const body = typeof response.data === 'string' ? response.data : String(response.data ?? '');

  if (contentType.includes('text/plain')) {
    return {
      url,
      text: truncate(normalizeWhitespace(body))
    };
  }

  if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
    return { url };
  }

  const title = extractTitle(body);
  const description = extractMetaDescription(body);
  const text = truncate(normalizeWhitespace(extractTextFromHtml(body)));

  return {
    url,
    title,
    description,
    text
  };
};

export const extractFirstUrl = (content: string): string | null => {
  const match = content.match(/\bhttps?:\/\/[^\s<>()"]+/i);
  if (!match) {
    return null;
  }
  return trimTrailingPunctuation(match[0]);
};

const fetchWithRedirects = async (initialUrl: string) => {
  let currentUrl = initialUrl;

  for (let i = 0; i <= MAX_REDIRECTS; i += 1) {
    await assertSafeUrl(currentUrl);
    const response = await axios.get(currentUrl, {
      timeout: FETCH_TIMEOUT_MS,
      maxContentLength: MAX_BODY_BYTES,
      maxBodyLength: MAX_BODY_BYTES,
      responseType: 'text',
      maxRedirects: 0,
      validateStatus: (status) => status >= 200 && status < 400,
      headers: buildRequestHeaders(currentUrl)
    });

    if (response.status >= 300 && response.status < 400 && response.headers.location) {
      currentUrl = new URL(response.headers.location, currentUrl).toString();
      continue;
    }

    return response;
  }

  throw new Error('Too many redirects');
};

const assertSafeUrl = async (url: string): Promise<void> => {
  const parsed = new URL(url);
  const hostname = parsed.hostname.toLowerCase();

  if (isBlockedHostname(hostname)) {
    throw new Error('Blocked hostname');
  }

  const ipType = net.isIP(hostname);
  if (ipType) {
    if (isPrivateAddress(hostname)) {
      throw new Error('Blocked IP address');
    }
    return;
  }

  const records = await dns.lookup(hostname, { all: true, verbatim: true });
  if (records.length === 0) {
    throw new Error('DNS lookup failed');
  }
  for (const record of records) {
    if (isPrivateAddress(record.address)) {
      throw new Error('Blocked IP address');
    }
  }
};

const isBlockedHostname = (hostname: string): boolean => {
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
    return true;
  }
  if (hostname.endsWith('.local') || hostname.endsWith('.internal')) {
    return true;
  }
  if (hostname.endsWith('.home') || hostname.endsWith('.lan')) {
    return true;
  }
  return false;
};

const isPrivateAddress = (ip: string): boolean => {
  if (net.isIP(ip) === 4) {
    return isPrivateIpv4(ip);
  }
  if (net.isIP(ip) === 6) {
    return isPrivateIpv6(ip);
  }
  return true;
};

const isPrivateIpv4 = (ip: string): boolean => {
  return (
    isIpv4InCidr(ip, '0.0.0.0', 8) ||
    isIpv4InCidr(ip, '10.0.0.0', 8) ||
    isIpv4InCidr(ip, '100.64.0.0', 10) ||
    isIpv4InCidr(ip, '127.0.0.0', 8) ||
    isIpv4InCidr(ip, '169.254.0.0', 16) ||
    isIpv4InCidr(ip, '172.16.0.0', 12) ||
    isIpv4InCidr(ip, '192.0.0.0', 24) ||
    isIpv4InCidr(ip, '192.0.2.0', 24) ||
    isIpv4InCidr(ip, '192.168.0.0', 16) ||
    isIpv4InCidr(ip, '198.18.0.0', 15) ||
    isIpv4InCidr(ip, '198.51.100.0', 24) ||
    isIpv4InCidr(ip, '203.0.113.0', 24) ||
    isIpv4InCidr(ip, '224.0.0.0', 4) ||
    isIpv4InCidr(ip, '240.0.0.0', 4)
  );
};

const isIpv4InCidr = (ip: string, base: string, maskBits: number): boolean => {
  const ipInt = ipv4ToInt(ip);
  const baseInt = ipv4ToInt(base);
  if (ipInt === null || baseInt === null) {
    return false;
  }
  const mask = maskBits === 0 ? 0 : (~0 << (32 - maskBits)) >>> 0;
  return (ipInt & mask) === (baseInt & mask);
};

const ipv4ToInt = (ip: string): number | null => {
  const parts = ip.split('.');
  if (parts.length !== 4) {
    return null;
  }
  let value = 0;
  for (const part of parts) {
    const num = Number(part);
    if (!Number.isInteger(num) || num < 0 || num > 255) {
      return null;
    }
    value = (value << 8) + num;
  }
  return value >>> 0;
};

const isPrivateIpv6 = (ip: string): boolean => {
  const normalized = ip.toLowerCase();
  if (normalized === '::1' || normalized === '0:0:0:0:0:0:0:1') {
    return true;
  }
  if (normalized === '::' || normalized === '0:0:0:0:0:0:0:0') {
    return true;
  }
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) {
    return true;
  }
  if (
    normalized.startsWith('fe8') ||
    normalized.startsWith('fe9') ||
    normalized.startsWith('fea') ||
    normalized.startsWith('feb')
  ) {
    return true;
  }
  if (normalized.startsWith('::ffff:')) {
    const mapped = normalized.replace('::ffff:', '');
    return isPrivateIpv4(mapped);
  }
  return false;
};

const buildRequestHeaders = (url: string): Record<string, string> => {
  const headers: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'Cache-Control': 'no-cache'
  };

  const referer = buildReferer(url);
  if (referer) {
    headers.Referer = referer;
  }

  return headers;
};

const trimTrailingPunctuation = (value: string): string => {
  return value.replace(/[)\],.;!?]+$/g, '');
};

const buildReferer = (url: string): string | undefined => {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.endsWith('mp.weixin.qq.com')) {
      return 'https://mp.weixin.qq.com/';
    }
    return parsed.origin;
  } catch {
    return undefined;
  }
};

const normalizeUrl = (rawUrl: string): string => {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch (error) {
    throw new Error('Invalid URL');
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    throw new Error(`Unsupported URL protocol: ${parsed.protocol}`);
  }

  return parsed.toString();
};

const extractTitle = (html: string): string | undefined => {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!match) {
    return undefined;
  }
  const title = normalizeWhitespace(decodeHtmlEntities(match[1]));
  return title || undefined;
};

const extractMetaDescription = (html: string): string | undefined => {
  const nameMatch = html.match(/<meta[^>]+name=["']description["'][^>]*>/i);
  if (nameMatch) {
    const content = extractMetaContent(nameMatch[0]);
    if (content) {
      return normalizeWhitespace(decodeHtmlEntities(content));
    }
  }

  const ogMatch = html.match(/<meta[^>]+property=["']og:description["'][^>]*>/i);
  if (ogMatch) {
    const content = extractMetaContent(ogMatch[0]);
    if (content) {
      return normalizeWhitespace(decodeHtmlEntities(content));
    }
  }

  return undefined;
};

const extractMetaContent = (metaTag: string): string | undefined => {
  const contentMatch = metaTag.match(/content=["']([^"']+)["']/i);
  return contentMatch ? contentMatch[1] : undefined;
};

const extractTextFromHtml = (html: string): string => {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
};

const decodeHtmlEntities = (input: string): string => {
  return input
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => decodeNumericEntity(hex, 16))
    .replace(/&#([0-9]+);/g, (_, num: string) => decodeNumericEntity(num, 10));
};

const decodeNumericEntity = (value: string, radix: number): string => {
  const codePoint = Number.parseInt(value, radix);
  if (!Number.isFinite(codePoint)) {
    return '';
  }
  try {
    return String.fromCodePoint(codePoint);
  } catch {
    return '';
  }
};

const normalizeWhitespace = (text: string): string => {
  return text.replace(/\s+/g, ' ').trim();
};

const truncate = (text: string): string => {
  if (text.length <= MAX_TEXT_LENGTH) {
    return text;
  }
  return text.slice(0, MAX_TEXT_LENGTH);
};
