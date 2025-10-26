// status-n-price: combine domainstat status with domain-quotes pricing

import type { DomainStatus as UpstreamDomainStatus, CheckOptions as StatusCheckOptions } from 'domainstat';
import { check as statusCheck, checkBatch as statusCheckBatch } from 'domainstat';
import { DomainQuote as DomainPrices, DEFAULT_RATES } from 'domain-quotes';
export { DEFAULT_RATES } from 'domain-quotes';

// Minimal local types for quotes (domain-quotes ships JS only)
export type PriceQuote = {
  extension: string;
  currency: string;
  basePrice: number;
  discount: number;
  tax: number;
  totalPrice: number;
  symbol: string;
  transaction: 'create' | 'renew' | 'restore' | 'transfer';
};

export type StatusAndPrice = UpstreamDomainStatus & {
  price?: PriceQuote;
};

export type QuoteOptions = {
  discountCodes?: string[];
  now?: number | Date;
  discountPolicy?: 'stack' | 'max';
  transaction?: 'create' | 'renew' | 'restore' | 'transfer';
};

export interface StatusNPriceOptions {
  // Default currency used for pricing when not provided per call
  currency?: string;
  // Initialize domain-quotes with a custom rate config
  ratesConfig?: any; // DEFAULT_RATES-compatible shape
  // Default options passed to domainstat on each call
  statusOptions?: StatusCheckOptions;
}

export class StatusNPrice {
  private readonly prices: any;
  private readonly defaultCurrency: string;
  private readonly baseStatusOptions?: StatusCheckOptions;

  constructor(options: StatusNPriceOptions = {}) {
    const { currency = 'USD', ratesConfig = DEFAULT_RATES, statusOptions } = options;
    this.prices = new DomainPrices(ratesConfig);
    this.defaultCurrency = currency.toUpperCase();
    this.baseStatusOptions = statusOptions;
  }

  async check(domain: string, opts: {
    currency?: string;
    quote?: QuoteOptions;
    status?: StatusCheckOptions;
  } = {}): Promise<StatusAndPrice> {
    const status = await statusCheck(domain, { ...(this.baseStatusOptions ?? {}), ...(opts.status ?? {}) });
    let price: PriceQuote | undefined;
    if (status.availability === 'unregistered') {
      const currency = (opts.currency ?? this.defaultCurrency).toUpperCase();
      try {
        price = await this.prices.getPrice(domain, currency, opts.quote ?? {});
      } catch {
        // Unsupported extension or currency – ignore pricing
        price = undefined;
      }
    }
    return { ...status, price };
  }

  async checkBatch(domains: string[], opts: {
    currency?: string;
    quote?: QuoteOptions;
    status?: StatusCheckOptions;
  } = {}): Promise<StatusAndPrice[]> {
    const statuses = await statusCheckBatch(domains, { ...(this.baseStatusOptions ?? {}), ...(opts.status ?? {}) });
    const currency = (opts.currency ?? this.defaultCurrency).toUpperCase();
    const results = await Promise.all(
      statuses.map(async (s) => {
        let price: PriceQuote | undefined;
        if (s.availability === 'unregistered') {
          try {
            price = await this.prices.getPrice(s.domain, currency, opts.quote ?? {});
          } catch {
            price = undefined;
          }
        }
        return { ...s, price } as StatusAndPrice;
      }),
    );
    return results;
  }
}

// Simple functional API using a default instance (USD currency)
const defaultClient = new StatusNPrice();

export async function check(domain: string, options?: Parameters<StatusNPrice['check']>[1]) {
  return defaultClient.check(domain, options);
}

export async function checkBatch(domains: string[], options?: Parameters<StatusNPrice['checkBatch']>[1]) {
  return defaultClient.checkBatch(domains, options);
}
