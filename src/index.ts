// status-n-price: combine domainstat status with domain-quotes pricing

import { DEFAULT_CONFIG, DomainQuotes } from 'domain-quotes';
import type { CheckOptions as StatusCheckOptions, DomainStatus as UpstreamDomainStatus } from 'domainstat';
import { check as statusCheck, checkBatch as statusCheckBatch } from 'domainstat';

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
  ratesConfig?: any;
  // Default options passed to domainstat on each call
  statusOptions?: StatusCheckOptions;
}

// Extract the extension (TLD) from a domain name
function getExtension(domain: string): string {
  const normalized = domain.toLowerCase();
  const dotIndex = normalized.indexOf('.');
  if (dotIndex === -1 || dotIndex === normalized.length - 1) return normalized;
  return normalized.slice(dotIndex + 1);
}

export class StatusNPrice {
  private readonly domainQuotes: any;
  private readonly defaultCurrency: string;
  private readonly baseStatusOptions?: StatusCheckOptions;

  constructor (options: StatusNPriceOptions = {}) {
    const { currency = 'USD', ratesConfig = DEFAULT_CONFIG, statusOptions } = options;
    this.domainQuotes = new DomainQuotes(ratesConfig);
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
      const ext = getExtension(domain);
      try {
        price = await this.domainQuotes.getQuote(ext, currency, opts.quote ?? {});
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

    // Create a map for O(1) lookup and to preserve input order
    const statusMap = new Map<string, UpstreamDomainStatus>(
      statuses.map((s: UpstreamDomainStatus) => [s.domain, s])
    );

    // Process in original order
    const results = await Promise.all(
      domains.map(async (domain) => {
        const s = statusMap.get(domain);
        if (!s) {
          throw new Error(`Status not found for domain: ${domain}`);
        }
        let price: PriceQuote | undefined;
        if (s.availability === 'unregistered') {
          const ext = getExtension(s.domain);
          try {
            price = await this.domainQuotes.getQuote(ext, currency, opts.quote ?? {});
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
