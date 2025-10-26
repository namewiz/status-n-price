import test from 'node:test';
import assert from 'node:assert/strict';

// Only run these tests when network is available, since the
// implementation uses live DNS/RDAP and remote price data.
async function hasNetwork() {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const res = await fetch('https://example.com', { method: 'HEAD', signal: controller.signal });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

const NETWORK_OK = await hasNetwork();

if (!NETWORK_OK) {
  test('network-required', { skip: true }, () => {});
} else {
  const lib = await import('../dist/index.js');

  test('check returns status without price for registered domain', async () => {
    const res = await lib.check('google.com', { currency: 'USD' });
    assert.equal(res.domain, 'google.com');
    assert.equal(res.availability, 'registered');
    assert.equal(res.price, undefined);
  });

  test('check returns status with price for unregistered domain', async () => {
    const res = await lib.check('this-domain-should-not-exist-12345.com', { currency: 'USD' });
    assert.equal(res.domain, 'this-domain-should-not-exist-12345.com');
    assert.equal(res.availability, 'unregistered');
    assert.ok(res.price, 'expected price for unregistered domain');
    assert.equal(res.price.currency, 'USD');
    assert.equal(typeof res.price.totalPrice, 'number');
    assert.ok(res.price.totalPrice > 0);
  });

  test('checkBatch mixes registered and unregistered with prices where applicable', async () => {
    const [a, b] = await lib.checkBatch(['google.com', 'this-domain-should-not-exist-12345.org'], { currency: 'EUR' });
    assert.equal(a.domain, 'google.com');
    assert.equal(a.availability, 'registered');
    assert.equal(a.price, undefined);

    assert.equal(b.domain, 'this-domain-should-not-exist-12345.org');
    assert.equal(b.availability, 'unregistered');
    assert.ok(b.price);
    assert.equal(b.price.currency, 'EUR');
    assert.ok(b.price.totalPrice > 0);
  });
}
