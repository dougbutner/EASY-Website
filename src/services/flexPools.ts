import { CHAIN_ENDPOINTS } from '@/services/walletConstants';

export type FlexPoolRow = {
  id: number;
  token_symbol: string;
  token_contract: string;
  pool_ids: string;
};

/** Symbol string passed to `setflextoken` / `sprouttoken` / `interestoken` (letters only, no precision prefix). */
export function flexPoolRewardSymbol(row: FlexPoolRow): string {
  const raw = row.token_symbol?.trim() ?? '';
  if (raw.includes(',')) return raw.split(',').slice(1).join(',').trim();
  return raw;
}

export function flexPoolLabel(row: FlexPoolRow): string {
  const sym = flexPoolRewardSymbol(row);
  return `${sym} (${row.token_contract})`;
}

type GetTableRowsResponse = {
  rows?: FlexPoolRow[];
  more?: boolean;
  next_key?: string | number;
  message?: string;
};

/**
 * Reads `flexpools` on the token contract (`takeiteasy.hpp`: multi_index `"flexpools"_n`, struct `flexpool`).
 * Uses chain `get_table_rows` on the RPC host (EOSUSA first via `CHAIN_ENDPOINTS`).
 */
async function fetchFlexPoolsFromEndpoint(contract: string, endpoint: string): Promise<FlexPoolRow[]> {
  const out: FlexPoolRow[] = [];
  let lowerBound: string | undefined;

  for (;;) {
    const body: Record<string, unknown> = {
      code: contract,
      scope: contract,
      table: 'flexpools',
      json: true,
      limit: 500,
    };
    if (lowerBound !== undefined) body.lower_bound = lowerBound;

    const res = await fetch(`${endpoint}/v1/chain/get_table_rows`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as GetTableRowsResponse;
    if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
    const rows = data.rows ?? [];
    if (rows.length === 0 && out.length === 0 && !data.more) return out;
    out.push(...rows);
    if (!data.more) break;

    if (data.next_key !== undefined && data.next_key !== null) {
      lowerBound = String(data.next_key);
      continue;
    }

    const last = rows[rows.length - 1];
    if (!last) break;
    lowerBound = String(Number(last.id) + 1);
  }

  return out;
}

export async function fetchFlexPools(
  contract: string,
  endpoint?: string
): Promise<FlexPoolRow[]> {
  const candidates = endpoint ? [endpoint] : CHAIN_ENDPOINTS;
  let lastError: Error | null = null;
  for (const ep of candidates) {
    try {
      return await fetchFlexPoolsFromEndpoint(contract, ep);
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw lastError ?? new Error('Failed to load flex pools');
}
