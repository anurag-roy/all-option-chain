import { getUniqueExpiryDates } from '@server/lib/utils/db';
import { logger } from '@server/lib/logger';
import {
  calculateMarketMinutesInRange,
  calculateMarketMinutesTillExpiry,
  loadHolidayCache,
} from '@server/lib/market-minutes';
import { parse, parseISO, subYears } from 'date-fns';

const EXPIRY_CACHE_TTL_MS = 60 * 1000;

type ExpiryMinutesCacheEntry = {
  value: number;
  timestamp: number;
};

class MarketMinutesCache {
  private marketMinutesInLastYear: number | null = null;
  private validExpiryDates: Set<string> = new Set();
  private expiryMinutesCache: Map<string, ExpiryMinutesCacheEntry> = new Map();

  getMarketMinutesInLastYear(): number {
    if (this.marketMinutesInLastYear !== null) {
      return this.marketMinutesInLastYear;
    }

    const today = new Date();
    const oneYearAgo = subYears(today, 1);

    this.marketMinutesInLastYear = calculateMarketMinutesInRange(oneYearAgo, today);
    logger.info(`Cached market minutes in last year: ${this.marketMinutesInLastYear}`);

    return this.marketMinutesInLastYear;
  }

  getMarketMinutesTillExpiry(expiryDate: string): number {
    if (!this.validExpiryDates.has(expiryDate)) {
      logger.warn(`Unknown expiry date: "${expiryDate}". Returning 0.`);
      return 0;
    }

    const now = Date.now();
    const cached = this.expiryMinutesCache.get(expiryDate);

    if (cached && now - cached.timestamp < EXPIRY_CACHE_TTL_MS) {
      return cached.value;
    }

    const value = calculateMarketMinutesTillExpiry(expiryDate);
    this.expiryMinutesCache.set(expiryDate, { value, timestamp: now });

    return value;
  }

  private preValidateExpiryDates(expiryDates: string[]): void {
    logger.info(`Pre-validating ${expiryDates.length} expiry dates...`);

    for (const date of expiryDates) {
      if (this.isValidExpiryDate(date)) {
        this.validExpiryDates.add(date);
      } else {
        logger.warn(`Skipping invalid expiry date: "${date}"`);
      }
    }

    logger.info(`Validated ${this.validExpiryDates.size} expiry dates`);
  }

  private isValidExpiryDate(expiryDate: string): boolean {
    if (!expiryDate || typeof expiryDate !== 'string' || expiryDate.trim() === '') {
      return false;
    }

    try {
      const trimmed = expiryDate.trim();
      let parsed: Date;

      if (trimmed.match(/^\d{4}-\d{2}-\d{2}$/)) {
        parsed = parseISO(trimmed);
      } else if (trimmed.match(/^\d{2}-[A-Z]{3}-\d{4}$/)) {
        parsed = parse(trimmed, 'dd-MMM-yyyy', new Date());
      } else {
        parsed = new Date(trimmed);
      }

      if (isNaN(parsed.getTime())) {
        return false;
      }

      const now = new Date();
      const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      const fiveYearsFromNow = new Date(now.getFullYear() + 5, now.getMonth(), now.getDate());

      return parsed >= oneYearAgo && parsed <= fiveYearsFromNow;
    } catch {
      return false;
    }
  }

  calculateSD(av: number, expiryDate: string): number {
    const T = this.getMarketMinutesInLastYear();
    const N = this.getMarketMinutesTillExpiry(expiryDate);

    if (N === 0 || T === 0) return 0;

    return (av * 100) / Math.sqrt(T / N);
  }

  calculateSigmaN(sigma: number, sdMultiplier: number): number {
    return sigma * sdMultiplier;
  }

  calculateSigmaX(sigmaN: number, expiryDate: string): number {
    if (!sigmaN || sigmaN <= 0) return 0;

    const T = this.getMarketMinutesInLastYear();
    const N = this.getMarketMinutesTillExpiry(expiryDate);

    if (N === 0 || T === 0) return 0;

    return sigmaN / Math.sqrt(T / N);
  }

  calculateSigmaXI(sigmaN: number, sigmaX: number, optionType: 'CE' | 'PE'): number {
    if (!sigmaN || sigmaN < 0 || !sigmaX || sigmaX < 0) return 0;
    return optionType === 'CE' ? sigmaN + sigmaX : sigmaN - sigmaX;
  }

  calculateAllSigmas(
    av: number,
    sdMultiplier: number,
    expiryDate: string,
    optionType: 'CE' | 'PE'
  ): {
    sigma: number;
    sigmaN: number;
    sigmaX: number;
    sigmaXI: number;
  } {
    const sigma = this.calculateSD(av, expiryDate);
    const sigmaN = this.calculateSigmaN(sigma, sdMultiplier);
    const sigmaX = this.calculateSigmaX(sigmaN, expiryDate);
    const sigmaXI = this.calculateSigmaXI(sigmaN, sigmaX, optionType);

    return { sigma, sigmaN, sigmaX, sigmaXI };
  }

  async initializeRuntimeCache(): Promise<void> {
    logger.info('Initializing market minutes cache at runtime...');

    try {
      await loadHolidayCache();
      this.getMarketMinutesInLastYear();

      const uniqueExpiryDates = await getUniqueExpiryDates();
      this.preValidateExpiryDates(uniqueExpiryDates);

      logger.info('Runtime cache initialization completed successfully!');
    } catch (error) {
      logger.error('Failed to initialize runtime cache:', error);
    }
  }

  clearCache(): void {
    this.marketMinutesInLastYear = null;
    this.validExpiryDates.clear();
    this.expiryMinutesCache.clear();
  }

  getCacheStatus() {
    return {
      marketMinutesInLastYear: this.marketMinutesInLastYear,
      validExpiryDatesCount: this.validExpiryDates.size,
      validExpiryDates: Array.from(this.validExpiryDates),
      expiryMinutesCacheSize: this.expiryMinutesCache.size,
    };
  }
}

export const marketMinutesCache = new MarketMinutesCache();
