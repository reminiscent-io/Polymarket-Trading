/**
 * Decimal normalization utilities for Polymarket token standards
 *
 * USDCe (USDC on Polygon): 6 decimals
 * CTF (Conditional Token Framework): 18 decimals
 *
 * When processing raw on-chain data, values must be divided by the
 * appropriate multiplier to get human-readable amounts.
 *
 * Note: Polymarket Data API may return pre-normalized values.
 * Always verify the data source before applying normalization.
 */

// USDCe has 6 decimals (1 USDC = 1,000,000 base units)
export const USDC_DECIMALS = 6;
export const USDC_MULTIPLIER = 10 ** USDC_DECIMALS; // 1,000,000

// CTF tokens have 18 decimals (1 token = 10^18 base units)
export const CTF_DECIMALS = 18;
export const CTF_MULTIPLIER = 10 ** CTF_DECIMALS; // 1,000,000,000,000,000,000

/**
 * Normalize raw USDC amount to human-readable value
 * @param rawAmount Raw amount in base units (e.g., 1000000 = 1 USDC)
 * @returns Normalized amount (e.g., 1.0)
 *
 * @example
 * normalizeUSDC(1000000) // Returns: 1.0
 * normalizeUSDC(2500000) // Returns: 2.5
 */
export function normalizeUSDC(rawAmount: number): number {
  return rawAmount / USDC_MULTIPLIER;
}

/**
 * Normalize raw CTF token amount to human-readable value
 * @param rawAmount Raw amount in base units (e.g., 10^18 = 1 token)
 * @returns Normalized amount (e.g., 1.0)
 *
 * @example
 * normalizeCTF(1000000000000000000) // Returns: 1.0
 */
export function normalizeCTF(rawAmount: number): number {
  return rawAmount / CTF_MULTIPLIER;
}

/**
 * Format normalized USDC amount to raw base units
 * @param normalized Normalized amount (e.g., 1.0)
 * @returns Raw amount in base units (e.g., 1000000)
 *
 * @example
 * formatUSDC(1.0) // Returns: 1000000
 * formatUSDC(2.5) // Returns: 2500000
 */
export function formatUSDC(normalized: number): number {
  return normalized * USDC_MULTIPLIER;
}

/**
 * Format normalized CTF token amount to raw base units
 * @param normalized Normalized amount (e.g., 1.0)
 * @returns Raw amount in base units (e.g., 10^18)
 *
 * @example
 * formatCTF(1.0) // Returns: 1000000000000000000
 */
export function formatCTF(normalized: number): number {
  return normalized * CTF_MULTIPLIER;
}

/**
 * Check if a value appears to be in raw (unnormalized) format
 * Heuristic: If value > 1000, likely raw USDC; if > 10^15, likely raw CTF
 *
 * @param value Amount to check
 * @returns Object indicating if value appears to be raw and suggested type
 */
export function detectRawValue(value: number): {
  isRaw: boolean;
  likelyType: 'USDC' | 'CTF' | 'normalized' | 'unknown';
} {
  if (value >= 10 ** 15) {
    return { isRaw: true, likelyType: 'CTF' };
  }
  if (value >= 1000) {
    return { isRaw: true, likelyType: 'USDC' };
  }
  if (value > 0 && value < 1000) {
    return { isRaw: false, likelyType: 'normalized' };
  }
  return { isRaw: false, likelyType: 'unknown' };
}
