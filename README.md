# Status N Price

Domain availability and price quotes in one tiny package.

This library glues together two published packages:
- Status via domainstat
- Pricing via domain-quotes

Install

```bash
npm i status-n-price
```

Quick start

```ts
import { check, checkBatch } from 'status-n-price';

const one = await check('example.com', { currency: 'USD' });
// → { domain, availability, resolver, price?: { symbol, totalPrice, ... } }

const many = await checkBatch(['example.com', 'cool.ai'], { currency: 'EUR' });
```

Class usage

```ts
import { StatusNPrice, DEFAULT_RATES } from 'status-n-price';

const snp = new StatusNPrice({
  currency: 'USD',
  ratesConfig: DEFAULT_RATES, // optional override of domain-quotes config
  statusOptions: { burstMode: true }, // forwarded to domainstat
});

const exampleResult = await snp.check('example.com', {
  quote: { discountCodes: ['SAVE10'] },
});
console.log(exampleResult)
// output
// {
//   domain: 'example.com', availability: 'registered', resolver: 'dns.doh',
//   raw: {...}, latencies: { ... },
//   error: undefined,
//   price: undefined
// }

const exampleUnregistered = await snp.check('example-undefined.com', {
  quote: { discountCodes: ['SAVE10'] },
});
console.log(exampleUnregistered)
// output
// {
//   domain: 'example-undefined.com', availability: 'unregistered', resolver: 'rdap',
//   raw: {...}, latencies: { ... },
//   error: undefined,
//   price: {
//     extension: 'com',
//     currency: 'USD',
//     basePrice: 11.98,
//     discount: 0,
//     tax: 0,
//     totalPrice: 11.98,
//     symbol: '$',
//     transaction: 'create'
//   }
// }
```

Notes

- `price` is only present when a domain is unregistered and supported by domain-quotes.
- Currency defaults to USD. Pass `currency` per call to override.
- Any `statusOptions` are forwarded to domainstat.

License

MIT
