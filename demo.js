import { DEFAULT_RATES, StatusNPrice } from 'status-n-price';

const snp = new StatusNPrice({
  currency: 'USD',
  ratesConfig: DEFAULT_RATES, // optional override of domain-quotes config
  statusOptions: { burstMode: true }, // forwarded to domainstat
});

const result = await snp.check('example-undefined.com', {
  quote: { discountCodes: ['SAVE10'] },
});
console.log(result);
