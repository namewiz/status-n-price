import test from 'node:test';
import assert from 'node:assert/strict';

// These tests hit live dependencies (DNS/RDAP + pricing).
// Skip when network is unavailable to avoid flaky CI in offline envs.
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

  const UNREG_COM = 'this-domain-should-not-exist-12345.com';
  const UNREG_ORG = 'this-domain-should-not-exist-12345.org';

  test('default client: default USD currency and per-call override', async () => {
    // default USD when no currency is provided
    const resDefault = await lib.check(UNREG_COM);
    assert.equal(resDefault.domain, UNREG_COM);
    assert.equal(resDefault.availability, 'unregistered');
    assert.ok(resDefault.price);
    assert.equal(resDefault.price.currency, 'USD');
    assert.equal(typeof resDefault.price.totalPrice, 'number');
    assert.ok(resDefault.price.totalPrice > 0);

    // lowercase currency should be uppercased
    const resNgn = await lib.check(UNREG_COM, { currency: 'ngn' });
    assert.equal(resNgn.domain, UNREG_COM);
    assert.equal(resNgn.availability, 'unregistered');
    assert.ok(resNgn.price);
    assert.equal(resNgn.price.currency, 'NGN');
  });

  test('instance default currency and per-call override', async () => {
    const snp = new lib.StatusNPrice({ currency: 'ngn' });

    const r1 = await snp.check(UNREG_COM);
    assert.equal(r1.availability, 'unregistered');
    assert.ok(r1.price);
    assert.equal(r1.price.currency, 'NGN');

    const r2 = await snp.check(UNREG_COM, { currency: 'usd' });
    assert.equal(r2.availability, 'unregistered');
    assert.ok(r2.price);
    assert.equal(r2.price.currency, 'USD');
  });

  test('unsupported currency results in undefined price (graceful fallback)', async () => {
    const res = await lib.check(UNREG_ORG, { currency: 'ZZZ' });
    assert.equal(res.domain, UNREG_ORG);
    assert.equal(res.availability, 'unregistered');
    assert.equal(res.price, undefined);
  });

  test('quote options: transaction types reflected in result', async () => {
    for (const tx of ['create', 'renew', 'transfer', 'restore']) {
      const res = await lib.check(UNREG_COM, { currency: 'USD', quote: { transaction: tx } });
      assert.equal(res.domain, UNREG_COM);
      assert.equal(res.availability, 'unregistered');
      assert.ok(res.price, `expected price for tx=${tx}`);
      assert.equal(res.price.currency, 'USD');
      assert.equal(res.price.transaction, tx);
    }
  });

  test('quote options: discount codes, discount policy, and now accepted', async () => {
    const res = await lib.check(UNREG_ORG, {
      currency: 'USD',
      quote: {
        discountCodes: ['SAVE10', 'WELCOME'],
        discountPolicy: 'max',
        now: new Date('2025-01-01T00:00:00Z'),
      },
    });
    assert.equal(res.domain, UNREG_ORG);
    assert.equal(res.availability, 'unregistered');
    assert.ok(res.price);
    assert.equal(res.price.currency, 'USD');
    assert.equal(typeof res.price.discount, 'number');
    assert.equal(typeof res.price.totalPrice, 'number');
  });

  test('status options forwarded (no assertion on resolver, just that it works)', async () => {
    const res = await lib.check(UNREG_COM, { status: { burstMode: true } });
    assert.equal(res.domain, UNREG_COM);
    assert.ok(['unregistered', 'registered', 'unknown', 'invalid'].includes(res.availability));
  });

  test('checkBatch preserves order and applies currency/quote/status options', async () => {
    const domains = ['google.com', UNREG_COM];
    const [a, b] = await lib.checkBatch(domains, {
      currency: 'ngn',
      quote: { transaction: 'transfer' },
      status: { burstMode: true },
    });
    // order preserved
    assert.equal(a.domain, domains[0]);
    assert.equal(b.domain, domains[1]);

    // first is registered
    assert.equal(a.availability, 'registered');
    assert.equal(a.price, undefined);

    // second is unregistered with applied currency/quote
    assert.equal(b.availability, 'unregistered');
    assert.ok(b.price);
    assert.equal(b.price.currency, 'NGN');
    assert.equal(b.price.transaction, 'transfer');
  });
}

