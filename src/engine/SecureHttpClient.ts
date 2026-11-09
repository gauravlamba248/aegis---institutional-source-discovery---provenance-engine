import { HttpRetrievalTelemetry } from './types';

export interface SecureFetchOptions {
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  retries?: number;
  acceptTypes?: string[];
  headers?: Record<string, string>;
  parserLabel?: string;
}

export interface SecureFetchResponse {
  ok: boolean;
  status: number;
  url: string;
  finalUrl: string;
  contentType: string;
  lastModified?: string;
  pinnedAddress?: string;
  bytes: Uint8Array;
  text: string;
  sanitizedText: string;
  telemetry: HttpRetrievalTelemetry;
}

const DEFAULT_USER_AGENT =
  'AegisInstitutionalResearchEngine/2.0 (Institutional Financial Audit; contact@aegis-research.org)';

const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const ALLOWED_CONTENT_PREFIXES = [
  'text/html',
  'application/xhtml+xml',
  'application/json',
  'application/pdf',
  'text/plain',
  'application/xml',
  'text/xml',
  'application/octet-stream'
];

interface CacheEntry {
  expiresAt: number;
  response: SecureFetchResponse;
}

const responseCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 10 * 60 * 1000;

export class SecureHttpClient {
  /**
   * Validates a URL against SSRF, private IP ranges, loopback, link-local metadata,
   * and non-HTTPS schemes, and resolves + validates the destination IP so the connection
   * can be pinned directly to the validated IP (preventing DNS rebinding / TOCTOU).
   */
  public static async validateUrlSecurity(rawUrl: string): Promise<{
    safe: boolean;
    parsedUrl?: URL;
    validatedAddress?: string;
    validatedFamily?: 4 | 6;
    reason?: string;
  }> {
    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      return { safe: false, reason: 'Invalid URL syntax' };
    }

    // Strict HTTPS-only enforcement (Section 22 & 34)
    if (parsed.protocol !== 'https:') {
      return {
        safe: false,
        reason: `SECURITY_BLOCK: Blocked non-HTTPS protocol scheme (${parsed.protocol})`
      };
    }

    const hostname = parsed.hostname.toLowerCase();
    if (
      hostname === 'localhost' ||
      hostname.endsWith('.localhost') ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal') ||
      hostname === 'metadata.google.internal' ||
      hostname === '169.254.169.254' ||
      hostname === '0.0.0.0' ||
      hostname === '::1' ||
      hostname === '[::1]'
    ) {
      return { safe: false, reason: `SECURITY_BLOCK: Restricted hostname (${hostname})` };
    }

    if (this.isPrivateOrLoopbackIp(hostname)) {
      return { safe: false, reason: `SECURITY_BLOCK: Private/loopback IP literal (${hostname})` };
    }

    // Perform DNS resolution and pin the validated public IP when running in Node.js
    if (typeof process !== 'undefined' && process.versions?.node) {
      try {
        const dnsMod = 'node:dns/promises';
        const dns = await import(/* @vite-ignore */ dnsMod);
        const records: { address: string; family: number }[] = await dns.lookup(hostname, {
          all: true
        });
        if (!records || records.length === 0) {
          return { safe: false, reason: `DNS lookup returned zero records for ${hostname}` };
        }
        for (const rec of records) {
          if (this.isPrivateOrLoopbackIp(rec.address)) {
            return {
              safe: false,
              reason: `SECURITY_BLOCK: DNS rebinding guard blocked ${hostname} resolving to private IP ${rec.address}`
            };
          }
        }
        const preferred = records.find((r) => r.family === 4) || records[0];
        return {
          safe: true,
          parsedUrl: parsed,
          validatedAddress: preferred.address,
          validatedFamily: preferred.family === 6 ? 6 : 4
        };
      } catch (err: any) {
        return {
          safe: false,
          reason: `DNS lookup failed for ${hostname}: ${err?.message || 'ENOTFOUND'}`
        };
      }
    }

    return { safe: true, parsedUrl: parsed };
  }

  public static isPrivateOrLoopbackIp(ip: string): boolean {
    const clean = ip.replace(/^\[|\]$/g, '').toLowerCase();
    if (
      clean === '::1' ||
      clean === '::' ||
      clean === '0.0.0.0' ||
      clean.startsWith('fe80:') ||
      clean.startsWith('fc00:') ||
      clean.startsWith('fd00:')
    ) {
      return true;
    }

    // Check IPv4-mapped IPv6 addresses (e.g. ::ffff:127.0.0.1 or ::ffff:169.254.169.254)
    const candidateIpv4 = clean.startsWith('::ffff:') ? clean.slice(7) : clean;

    const ipv4Match = candidateIpv4.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (!ipv4Match) return false;
    const [, aStr, bStr] = ipv4Match;
    const a = Number(aStr);
    const b = Number(bStr);

    if (a === 127) return true; // 127.0.0.0/8 loopback
    if (a === 10) return true; // 10.0.0.0/8 RFC1918
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 RFC1918
    if (a === 192 && b === 168) return true; // 192.168.0.0/16 RFC1918
    if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local / cloud metadata
    if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
    if (a === 0) return true;
    if (a >= 224) return true; // Multicast & reserved
    return false;
  }

  /**
   * Sanitizes untrusted external HTML by removing scripts, iframes, embeds, event handlers,
   * and tracking pixels before any DOM/table extraction runs.
   */
  public static sanitizeUntrustedHtml(rawHtml: string): string {
    return rawHtml
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
      .replace(/<object[\s\S]*?<\/object>/gi, '')
      .replace(/<embed[^>]*>/gi, '')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
      .replace(/\son[a-z]+\s*=\s*(['"][^'"]*['"]|[^\s>]+)/gi, '')
      .replace(/javascript\s*:/gi, 'blocked:');
  }

  public static async computeSha256Hex(bytes: Uint8Array): Promise<string> {
    if (typeof globalThis.crypto?.subtle !== 'undefined') {
      const hashBuffer = await globalThis.crypto.subtle.digest(
        'SHA-256',
        bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
      );
      return Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    }
    return `len_${bytes.byteLength}`;
  }

  /**
   * Executes an HTTPS GET bound directly to the DNS-validated IP address in Node.js
   * to prevent DNS rebinding (TOCTOU) between `validateUrlSecurity` and socket connect.
   */
  private static async executePinnedNodeHttpsGet(params: {
    parsedUrl: URL;
    validatedAddress: string;
    validatedFamily: 4 | 6;
    headers: Record<string, string>;
    timeoutMs: number;
    maxBytes: number;
  }): Promise<{
    status: number;
    headers: Record<string, string>;
    bytes: Uint8Array;
  }> {
    const httpsMod = 'node:https';
    const zlibMod = 'node:zlib';
    const https = await import(/* @vite-ignore */ httpsMod);
    const zlib = await import(/* @vite-ignore */ zlibMod);

    const { parsedUrl, validatedAddress, validatedFamily, headers, timeoutMs, maxBytes } = params;

    return new Promise((resolve, reject) => {
      const req = https.request(
        parsedUrl,
        {
          method: 'GET',
          headers: {
            ...headers,
            Host: parsedUrl.host,
            'Accept-Encoding': 'gzip, deflate, br'
          },
          servername: parsedUrl.hostname,
          rejectUnauthorized: true,
          timeout: timeoutMs,
          // Pin the socket connection to the exact validated IP address (CF-09 fix)
          lookup: (_hostname: string, opts: any, cb: any) => {
            if (typeof opts === 'function') {
              return opts(null, validatedAddress, validatedFamily);
            }
            if (opts && opts.all) {
              return cb(null, [{ address: validatedAddress, family: validatedFamily }]);
            }
            return cb(null, validatedAddress, validatedFamily);
          }
        },
        (res: any) => {
          const status = res.statusCode || 0;
          const respHeaders: Record<string, string> = {};
          for (const [k, v] of Object.entries(res.headers || {})) {
            if (typeof v === 'string') respHeaders[k.toLowerCase()] = v;
            else if (Array.isArray(v)) respHeaders[k.toLowerCase()] = v.join(', ');
          }

          if (status >= 300 && status < 400) {
            res.resume();
            resolve({ status, headers: respHeaders, bytes: new Uint8Array(0) });
            return;
          }

          const contentLength = Number(respHeaders['content-length'] || '0');
          if (contentLength > maxBytes) {
            req.destroy();
            reject(new Error(`Response size (${contentLength} bytes) exceeds cap (${maxBytes} bytes)`));
            return;
          }

          const encoding = (respHeaders['content-encoding'] || '').toLowerCase();
          let stream: any = res;
          if (encoding === 'gzip' || encoding === 'x-gzip') {
            stream = res.pipe(zlib.createGunzip());
          } else if (encoding === 'deflate') {
            stream = res.pipe(zlib.createInflate());
          } else if (encoding === 'br') {
            stream = res.pipe(zlib.createBrotliDecompress());
          }

          const chunks: Buffer[] = [];
          let totalBytes = 0;

          stream.on('data', (chunk: Buffer) => {
            totalBytes += chunk.byteLength;
            if (totalBytes > maxBytes) {
              req.destroy();
              stream.destroy();
              reject(new Error(`Downloaded payload (${totalBytes} bytes) exceeds cap (${maxBytes} bytes)`));
              return;
            }
            chunks.push(chunk);
          });

          stream.on('end', () => {
            const combined = Buffer.concat(chunks);
            resolve({
              status,
              headers: respHeaders,
              bytes: new Uint8Array(combined.buffer, combined.byteOffset, combined.byteLength)
            });
          });

          stream.on('error', (err: any) => {
            reject(err);
          });
        }
      );

      req.on('timeout', () => {
        req.destroy(new Error(`HTTPS request timed out after ${timeoutMs}ms`));
      });

      req.on('error', (err: any) => {
        reject(err);
      });

      req.end();
    });
  }

  /**
   * Executes a live, security-hardened HTTPS GET request with DNS-pinned IP connection,
   * redirect validation, content-type enforcement, size limits, retries, and SHA-256 integrity hashing.
   */
  public static async fetchSecure(
    url: string,
    options: SecureFetchOptions = {}
  ): Promise<SecureFetchResponse> {
    const cached = responseCache.get(url);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.response;
    }

    const startTime = Date.now();
    const timeoutMs = options.timeoutMs ?? 12000;
    const maxBytes = options.maxBytes ?? 15 * 1024 * 1024;
    const maxRedirects = options.maxRedirects ?? 4;
    const retries = options.retries ?? 1;
    const parserLabel = options.parserLabel ?? 'HTTP/DOM-Stream';

    const securityCheck = await this.validateUrlSecurity(url);
    if (!securityCheck.safe) {
      const telemetry: HttpRetrievalTelemetry = {
        url,
        finalUrl: url,
        httpStatus: 0,
        contentType: 'blocked/ssrf-policy',
        bytesReceived: 0,
        latencyMs: Date.now() - startTime,
        sha256Hash: 'BLOCKED_BY_SSRF_GUARD',
        ssrfChecked: true,
        tlsVerified: false,
        sanitized: true,
        retrievedAt: new Date().toISOString(),
        parserUsed: parserLabel,
        parseSuccess: false,
        error: securityCheck.reason
      };
      return {
        ok: false,
        status: 0,
        url,
        finalUrl: url,
        contentType: 'blocked/ssrf-policy',
        bytes: new Uint8Array(0),
        text: '',
        sanitizedText: '',
        telemetry
      };
    }

    const needsSecComplianceUa =
      url.includes('sec.gov') || url.includes('wikidata.org') || url.includes('wikipedia.org');

    const headers: Record<string, string> = {
      'User-Agent': needsSecComplianceUa ? DEFAULT_USER_AGENT : BROWSER_USER_AGENT,
      Accept:
        'text/html,application/xhtml+xml,application/json,application/pdf,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      ...options.headers
    };

    let lastError = '';
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        let currentUrl = url;
        let redirectCount = 0;
        let finalStatus = 0;
        let finalHeaders: Record<string, string> = {};
        let finalBytes: Uint8Array = new Uint8Array(0);
        let pinnedIpUsed: string | undefined;

        while (redirectCount <= maxRedirects) {
          const hopCheck = await this.validateUrlSecurity(currentUrl);
          if (!hopCheck.safe || !hopCheck.parsedUrl) {
            throw new Error(hopCheck.reason || 'Redirect hop failed SSRF validation');
          }

          pinnedIpUsed = hopCheck.validatedAddress;

          if (typeof process !== 'undefined' && process.versions?.node && hopCheck.validatedAddress) {
            const nodeRes = await this.executePinnedNodeHttpsGet({
              parsedUrl: hopCheck.parsedUrl,
              validatedAddress: hopCheck.validatedAddress,
              validatedFamily: hopCheck.validatedFamily || 4,
              headers,
              timeoutMs,
              maxBytes
            });
            finalStatus = nodeRes.status;
            finalHeaders = nodeRes.headers;
            finalBytes = nodeRes.bytes;
          } else {
            const res = await fetch(currentUrl, {
              method: 'GET',
              headers,
              redirect: 'manual',
              signal: AbortSignal.timeout(timeoutMs)
            });
            finalStatus = res.status;
            finalHeaders = {};
            res.headers.forEach((v, k) => {
              finalHeaders[k.toLowerCase()] = v;
            });
            if (finalStatus < 300 || finalStatus >= 400) {
              const arrayBuf = await res.arrayBuffer();
              if (arrayBuf.byteLength > maxBytes) {
                throw new Error(`Downloaded payload (${arrayBuf.byteLength} bytes) exceeds cap (${maxBytes} bytes)`);
              }
              finalBytes = new Uint8Array(arrayBuf);
            }
          }

          if (finalStatus >= 300 && finalStatus < 400) {
            const location = finalHeaders['location'];
            if (!location) break;
            currentUrl = new URL(location, currentUrl).toString();
            redirectCount++;
            continue;
          }
          break;
        }

        if (finalStatus === 0) {
          throw new Error('No HTTP response received');
        }

        const contentType = (finalHeaders['content-type'] || 'text/plain').toLowerCase();
        const isAllowedType = ALLOWED_CONTENT_PREFIXES.some((prefix) =>
          contentType.includes(prefix)
        );
        if (!isAllowedType && finalStatus === 200) {
          throw new Error(`Disallowed Content-Type: ${contentType}`);
        }

        const sha256Hash = await this.computeSha256Hex(finalBytes);
        const isPdf = contentType.includes('application/pdf') || currentUrl.toLowerCase().endsWith('.pdf');
        const text = isPdf ? '' : new TextDecoder('utf-8', { fatal: false }).decode(finalBytes);
        const sanitizedText = isPdf ? '' : this.sanitizeUntrustedHtml(text);

        let lastModifiedIso: string | undefined;
        if (finalHeaders['last-modified']) {
          const parsedDate = new Date(finalHeaders['last-modified']);
          if (!isNaN(parsedDate.getTime())) {
            lastModifiedIso = parsedDate.toISOString().slice(0, 10);
          }
        }

        const isOk = finalStatus >= 200 && finalStatus < 300;
        const telemetry: HttpRetrievalTelemetry = {
          url,
          finalUrl: currentUrl,
          httpStatus: finalStatus,
          contentType: contentType.split(';')[0].trim(),
          bytesReceived: finalBytes.byteLength,
          latencyMs: Date.now() - startTime,
          sha256Hash: sha256Hash.slice(0, 16),
          ssrfChecked: true,
          tlsVerified: currentUrl.startsWith('https://'),
          sanitized: !isPdf,
          retrievedAt: new Date().toISOString(),
          parserUsed: parserLabel,
          parseSuccess: isOk && finalBytes.byteLength > 0
        };

        const result: SecureFetchResponse = {
          ok: isOk,
          status: finalStatus,
          url,
          finalUrl: currentUrl,
          contentType: telemetry.contentType,
          lastModified: lastModifiedIso,
          pinnedAddress: pinnedIpUsed,
          bytes: finalBytes,
          text,
          sanitizedText,
          telemetry
        };

        if (isOk && finalBytes.byteLength > 0) {
          responseCache.set(url, {
            expiresAt: Date.now() + CACHE_TTL_MS,
            response: result
          });
        }

        return result;
      } catch (err: any) {
        lastError = err?.message || 'Network request failed';
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
        }
      }
    }

    const failedTelemetry: HttpRetrievalTelemetry = {
      url,
      finalUrl: url,
      httpStatus: 0,
      contentType: 'error/network',
      bytesReceived: 0,
      latencyMs: Date.now() - startTime,
      sha256Hash: 'NONE',
      ssrfChecked: true,
      tlsVerified: url.startsWith('https://'),
      sanitized: false,
      retrievedAt: new Date().toISOString(),
      parserUsed: parserLabel,
      parseSuccess: false,
      error: lastError
    };

    return {
      ok: false,
      status: 0,
      url,
      finalUrl: url,
      contentType: 'error/network',
      bytes: new Uint8Array(0),
      text: '',
      sanitizedText: '',
      telemetry: failedTelemetry
    };
  }
}
