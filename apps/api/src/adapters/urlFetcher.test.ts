import { describe, it, expect } from 'vitest';
import { fetchAndExtract } from './urlFetcher.js';
import { FetchError } from '../domain/index.js';

describe('urlFetcher - SSRF & Validation Security Guards', () => {
  it('rejects invalid URLs', async () => {
    await expect(fetchAndExtract('not-a-url')).rejects.toThrow(FetchError);
  });

  it('rejects non-HTTP/HTTPS protocols like ftp:// or file://', async () => {
    await expect(fetchAndExtract('file:///etc/passwd')).rejects.toThrow('Only HTTP and HTTPS URLs are supported');
    await expect(fetchAndExtract('ftp://example.com/file')).rejects.toThrow('Only HTTP and HTTPS URLs are supported');
  });

  it('rejects embedded credentials in URL', async () => {
    await expect(fetchAndExtract('http://user:pass@example.com')).rejects.toThrow('URLs with embedded credentials are not allowed');
  });

  it('blocks loopback IP addresses (SSRF prevention)', async () => {
    await expect(fetchAndExtract('http://127.0.0.1/admin')).rejects.toThrow('Access to private or reserved network addresses is blocked');
  });

  it('blocks private class A/B/C IP addresses', async () => {
    await expect(fetchAndExtract('http://10.0.0.1')).rejects.toThrow('Access to private or reserved network addresses is blocked');
    await expect(fetchAndExtract('http://192.168.1.1')).rejects.toThrow('Access to private or reserved network addresses is blocked');
    await expect(fetchAndExtract('http://172.16.0.1')).rejects.toThrow('Access to private or reserved network addresses is blocked');
  });

  it('blocks cloud metadata endpoints', async () => {
    await expect(fetchAndExtract('http://169.254.169.254/latest/meta-data/')).rejects.toThrow('Access to cloud metadata endpoints is blocked');
  });
});
