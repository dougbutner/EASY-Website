import { CHAIN_ENDPOINTS } from '@/services/walletConstants';

/** Trim fractional trailing zeros on EOS-style `"1234.5000 EASY"` amount segments. */
function trimTrailingZerosFromAmount(amount: string): string {
  if (!amount.includes('.')) return amount;
  const [intPart, fracRaw = ''] = amount.split('.', 2);
  const frac = fracRaw.replace(/0+$/, '');
  return frac.length > 0 ? `${intPart}.${frac}` : intPart;
}

function addThousandsSeparators(intPart: string): string {
  if (!intPart) return intPart;
  const neg = intPart.startsWith('-');
  const digits = neg ? intPart.slice(1) : intPart;
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return neg ? `-${grouped}` : grouped;
}

/**
 * Pretty EOS asset line: thousands separators + trimmed trailing fractional zeros.
 * `"1237626726.64710000 MEME"` → `"1,237,626,726.6471 MEME"`
 */
export function formatFlexAssetPretty(assetLine: string): string {
  const s = assetLine.trim();
  const idx = s.lastIndexOf(' ');
  if (idx <= 0) return s;
  const rawAmount = s.slice(0, idx).trim();
  const sym = s.slice(idx + 1).trim();
  if (!sym || !/^-?\d+(\.\d+)?$/.test(rawAmount)) return s;

  const trimmed = trimTrailingZerosFromAmount(rawAmount);
  const [intPart, frac = ''] = trimmed.includes('.') ? trimmed.split('.', 2) : [trimmed, ''];
  const prettyInt = addThousandsSeparators(intPart);
  const num = frac.length > 0 ? `${prettyInt}.${frac}` : prettyInt;
  return `${num} ${sym}`;
}

type StatRow = {
  reflection_pool?: string;
};

type StatTableResponse = {
  rows?: StatRow[];
  message?: string;
};

/** `stat` row for a flex token: `scope` is the token symbol string (e.g. `EASY`, `WON`). */
async function fetchReflectionPoolFromEndpoint(
  contract: string,
  symbol: string,
  endpoint: string
): Promise<string | null> {
  const res = await fetch(`${endpoint}/v1/chain/get_table_rows`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      json: true,
      code: contract,
      scope: symbol,
      table: 'stat',
      limit: 10,
    }),
  });
  const data = (await res.json()) as StatTableResponse;
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  const pool = data.rows?.[0]?.reflection_pool;
  return typeof pool === 'string' && pool.trim().length > 0 ? pool.trim() : null;
}

export async function fetchReflectionPoolBalance(contract: string, symbol: string): Promise<string | null> {
  let lastError: Error | null = null;
  for (const endpoint of CHAIN_ENDPOINTS) {
    try {
      return await fetchReflectionPoolFromEndpoint(contract, symbol, endpoint);
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
    }
  }
  console.warn('flexReflectionPool:', lastError?.message ?? 'unknown error');
  return null;
}
