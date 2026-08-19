import { Readable } from 'stream';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import { config } from '../config/index.js';
import { logger } from '../config/logger.js';
import { FetchError, ExtractionError } from '../domain/index.js';

// Blocked IP ranges for SSRF protection
const BLOCKED_RANGES = [
  /^127\./,           // Loopback
  /^10\./,            // Private class A
  /^172\.(1[6-9]|2\d|3[01])\./,  // Private class B
  /^192\.168\./,      // Private class C
  /^169\.254\./,      // Link-local
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,  // Shared address space
  /^::1$/,            // IPv6 loopback
  /^fe80:/i,          // IPv6 link-local
  /^fc00:/i,          // IPv6 unique local
  /^fd00:/i,          // IPv6 unique local
  /^0\./,             // This network
  /^240\./,           // Reserved
  /^255\./,           // Broadcast
];

const METADATA_HOSTS = [
  '169.254.169.254',  // AWS/GCP metadata
  'metadata.google.internal',
  '100.100.100.200',  // Alibaba Cloud
];

const ALLOWED_CONTENT_TYPES = ['text/html', 'text/plain', 'application/xhtml+xml'];

function validateUrl(urlStr: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(urlStr);
  } catch {
    throw new FetchError('Invalid URL format', 'INVALID_URL');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new FetchError('Only HTTP and HTTPS URLs are supported', 'UNSUPPORTED_PROTOCOL');
  }

  if (parsed.username || parsed.password) {
    throw new FetchError('URLs with embedded credentials are not allowed', 'CREDENTIALS_IN_URL');
  }

  const hostname = parsed.hostname.toLowerCase();

  if (METADATA_HOSTS.includes(hostname)) {
    throw new FetchError('Access to cloud metadata endpoints is blocked', 'BLOCKED_ADDRESS');
  }

  for (const range of BLOCKED_RANGES) {
    if (range.test(hostname)) {
      throw new FetchError('Access to private or reserved network addresses is blocked', 'BLOCKED_ADDRESS');
    }
  }

  return parsed;
}

interface FetchedPage {
  title: string;
  text: string;
  url: string;
}

export async function fetchAndExtract(urlStr: string): Promise<FetchedPage> {
  const parsed = validateUrl(urlStr);
  logger.info({ event: 'url_fetch_start', host: parsed.hostname });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.FETCH_TIMEOUT_MS);

  let response: Response;
  let finalUrl = urlStr;
  let redirectCount = 0;

  try {
    response = await fetch(parsed.toString(), {
      signal: controller.signal,
      headers: {
        'User-Agent': 'AI-Knowledge-Inbox/1.0 (+https://github.com/ai-knowledge-inbox)',
        Accept: 'text/html,application/xhtml+xml,text/plain;q=0.9',
      },
      redirect: 'manual',
    });

    // Follow redirects manually so we can re-validate each destination
    while ([301, 302, 303, 307, 308].includes(response.status)) {
      if (redirectCount >= config.FETCH_MAX_REDIRECTS) {
        throw new FetchError(`Too many redirects (max ${config.FETCH_MAX_REDIRECTS})`, 'TOO_MANY_REDIRECTS');
      }
      const location = response.headers.get('location');
      if (!location) throw new FetchError('Redirect with no Location header', 'BAD_REDIRECT');
      finalUrl = new URL(location, finalUrl).toString();
      validateUrl(finalUrl); // Re-validate redirect target
      redirectCount++;
      response = await fetch(finalUrl, {
        signal: controller.signal,
        headers: { 'User-Agent': 'AI-Knowledge-Inbox/1.0' },
        redirect: 'manual',
      });
    }

    clearTimeout(timer);
  } catch (err: unknown) {
    clearTimeout(timer);
    if (err instanceof FetchError) throw err;
    const e = err as { name?: string; message?: string };
    if (e.name === 'AbortError') {
      throw new FetchError(`URL fetch timed out after ${config.FETCH_TIMEOUT_MS}ms`, 'FETCH_TIMEOUT');
    }
    throw new FetchError(`Failed to fetch URL: ${e.message ?? 'unknown error'}`, 'FETCH_FAILED');
  }

  if (!response.ok) {
    throw new FetchError(`URL returned HTTP ${response.status}`, 'HTTP_ERROR');
  }

  const contentType = response.headers.get('content-type') ?? '';
  const isAllowed = ALLOWED_CONTENT_TYPES.some((ct) => contentType.toLowerCase().includes(ct));
  if (!isAllowed) {
    throw new FetchError(
      `Unsupported content type: ${contentType}. Only HTML and plain text pages are supported.`,
      'UNSUPPORTED_CONTENT_TYPE',
    );
  }

  // Read with size limit
  const reader = response.body?.getReader();
  if (!reader) throw new FetchError('Response body is not readable', 'FETCH_FAILED');

  let bytesRead = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytesRead += value.length;
    if (bytesRead > config.FETCH_MAX_BYTES) {
      reader.cancel();
      throw new FetchError(`Response exceeds size limit of ${config.FETCH_MAX_BYTES} bytes`, 'RESPONSE_TOO_LARGE');
    }
    chunks.push(value);
  }

  const html = new TextDecoder().decode(
    Buffer.concat(chunks.map((c) => Buffer.from(c))),
  );

  return extractText(html, finalUrl);
}

function extractText(html: string, url: string): FetchedPage {
  try {
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    if (!article || !article.textContent || article.textContent.trim().length < 100) {
      throw new ExtractionError(
        'Could not extract sufficient readable text from this page. ' +
          'The page may require JavaScript, be behind a paywall, or contain primarily non-text content.',
      );
    }

    const text = article.textContent.replace(/\s+/g, ' ').trim();
    const title = (article.title || dom.window.document.title || new URL(url).hostname).slice(0, 200);

    logger.info({ event: 'url_extracted', host: new URL(url).hostname, textLength: text.length });
    return { title, text, url };
  } catch (err) {
    if (err instanceof ExtractionError) throw err;
    throw new ExtractionError('Failed to parse page content');
  }
}
