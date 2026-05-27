import { CHAIN_ENDPOINTS } from '@/services/walletConstants';
import { formatFlexAssetPretty } from '@/services/flexFlexerBalance';

export const FLEX_CHEST_TOKENS = [
  { symbol: 'EASY', contract: 'mon3y' },
  { symbol: 'WON', contract: 'w3won' },
  { symbol: 'GRAMS', contract: 'gold.mon3y' },
  { symbol: 'MEME', contract: 'm3m3' },
] as const;

export type FlexChestSymbol = (typeof FLEX_CHEST_TOKENS)[number]['symbol'];
export type FlexChestBalances = Record<FlexChestSymbol, string | null>;

type FlexerRow = {
  owner?: string;
  balance?: string;
};

async function fetchFlexerBalanceFromEndpoint(
  contract: string,
  account: string,
  endpoint: string
): Promise<string | null> {
  const res = await fetch(`${endpoint}/v1/chain/get_table_rows`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      json: true,
      code: contract,
      scope: contract,
      table: 'flexers',
      lower_bound: account,
      upper_bound: account,
      limit: 1,
    }),
  });
  const data = (await res.json()) as { rows?: FlexerRow[]; message?: string };
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  const row = data.rows?.[0];
  if (!row || String(row.owner ?? '').toLowerCase() !== account.toLowerCase()) return null;
  const bal = row.balance;
  if (typeof bal === 'string' && bal.trim()) return formatFlexAssetPretty(bal.trim());
  return null;
}

/** Flexer-table balances (reflection chest) for each core Flex token. */
export async function fetchFlexChestBalances(account: string): Promise<FlexChestBalances> {
  const acct = account.trim().toLowerCase();
  const entries = await Promise.all(
    FLEX_CHEST_TOKENS.map(async ({ symbol, contract }) => {
      let lastError: Error | null = null;
      for (const endpoint of CHAIN_ENDPOINTS) {
        try {
          const balance = await fetchFlexerBalanceFromEndpoint(contract, acct, endpoint);
          return [symbol, balance] as const;
        } catch (e) {
          lastError = e instanceof Error ? e : new Error(String(e));
        }
      }
      console.warn(`flexChest ${symbol}:`, lastError?.message ?? 'unknown error');
      return [symbol, null] as const;
    })
  );
  return Object.fromEntries(entries) as FlexChestBalances;
}

export function formatChestDisplay(symbol: FlexChestSymbol, balance: string | null): string {
  if (balance) return balance;
  return `0 ${symbol}`;
}
