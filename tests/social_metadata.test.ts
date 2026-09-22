import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from '../server/app';
import { resolvePageMetadata, injectDynamicMetaTags } from '../server/meta';

describe('Dynamic Social Share & Open Graph Metadata Suite', () => {
  let server: http.Server;
  let baseUrl: string;

  before(async () => {
    const app = createApp({ serveHtml: true });
    await new Promise<void>((resolve) => {
      server = http.createServer(app);
      server.listen(0, '127.0.0.1', () => {
        const address = server.address();
        if (address && typeof address === 'object') {
          baseUrl = `http://127.0.0.1:${address.port}`;
        }
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  test('resolvePageMetadata correctly resolves the Dangote Refinery article', async () => {
    const meta = await resolvePageMetadata(
      '/en-us/finance/dangote-refinery-ipo-strategic-asset-or-overpriced-gamble',
      'www.startupcreme.com',
      'https'
    );

    assert.equal(meta.pageType, 'article');
    assert.ok(meta.title.includes('Dangote Refinery IPO'), `Expected title to contain Dangote Refinery IPO, got: ${meta.title}`);
    assert.ok(meta.description && meta.description.length > 5, 'Expected non-empty description');
    assert.ok(meta.coverImage.startsWith('http'), `Expected valid absolute image URL, got: ${meta.coverImage}`);
    assert.ok(meta.coverImage.includes('Dangote-ref.jpg'), `Expected Dangote cover image, got: ${meta.coverImage}`);
    assert.equal(meta.canonicalUrl, 'https://www.startupcreme.com/en-us/finance/dangote-refinery-ipo-strategic-asset-or-overpriced-gamble');
    assert.equal(meta.section, 'Finance');
  });

  test('injectDynamicMetaTags replaces generic tags with article-specific Open Graph and Twitter cards', async () => {
    const dummyHtml = `<!doctype html><html><head><title>StartupCrème</title><meta property="og:title" content="Old" /></head><body><div id="root"></div></body></html>`;
    const resultHtml = await injectDynamicMetaTags(
      dummyHtml,
      '/en-us/finance/dangote-refinery-ipo-strategic-asset-or-overpriced-gamble',
      'www.startupcreme.com',
      'https'
    );

    assert.ok(resultHtml.includes('<title>Dangote Refinery IPO: Strategic Asset or Overpriced Gamble? | StartupCrème</title>'));
    assert.ok(resultHtml.includes('property="og:title" content="Dangote Refinery IPO: Strategic Asset or Overpriced Gamble? | StartupCrème"'));
    assert.ok(resultHtml.includes('property="og:image" content="https://businessfront.com/wp-content/uploads/2026/03/Dangote-ref.jpg"'));
    assert.ok(resultHtml.includes('name="twitter:card" content="summary_large_image"'));
    assert.ok(resultHtml.includes('name="twitter:title" content="Dangote Refinery IPO: Strategic Asset or Overpriced Gamble? | StartupCrème"'));
    assert.ok(resultHtml.includes('property="og:type" content="article"'));
    assert.ok(resultHtml.includes('application/ld+json'));
  });

  test('GET article route over HTTP delivers HTML with dynamic Open Graph tags', async () => {
    const res = await fetch(`${baseUrl}/en-us/finance/dangote-refinery-ipo-strategic-asset-or-overpriced-gamble`, {
      headers: {
        'x-forwarded-host': 'www.startupcreme.com',
        'x-forwarded-proto': 'https'
      }
    });

    assert.equal(res.status, 200);
    const contentType = res.headers.get('content-type') || '';
    assert.ok(contentType.includes('text/html'));

    const html = await res.text();
    assert.ok(html.includes('<title>Dangote Refinery IPO: Strategic Asset or Overpriced Gamble? | StartupCrème</title>'));
    assert.ok(html.includes('property="og:title" content="Dangote Refinery IPO: Strategic Asset or Overpriced Gamble? | StartupCrème"'));
    assert.ok(html.includes('property="og:image" content="https://businessfront.com/wp-content/uploads/2026/03/Dangote-ref.jpg"'));
    assert.ok(html.includes('property="og:url" content="https://www.startupcreme.com/en-us/finance/dangote-refinery-ipo-strategic-asset-or-overpriced-gamble"'));
  });

  test('Vercel rewrite header normalization correctly serves article metadata', async () => {
    const res = await fetch(`${baseUrl}/api`, {
      headers: {
        'x-matched-path': '/en-us/finance/dangote-refinery-ipo-strategic-asset-or-overpriced-gamble',
        'x-forwarded-host': 'www.startupcreme.com',
        'x-forwarded-proto': 'https'
      }
    });

    assert.equal(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes('Dangote Refinery IPO'));
    assert.ok(html.includes('property="og:title"'));
  });
});
