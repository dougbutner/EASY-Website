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
  return `${sym} @ ${row.token_contract} · pool #${row.id}`;
}

export async function fetchFlexPools(
  contract: string,
  endpoint: string = CHAIN_ENDPOINTS[0]
): Promise<FlexPoolRow[]> {
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
    const data = (await res.json()) as {
      rows?: FlexPoolRow[];
      more?: boolean;
      message?: string;
    };
    if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
    const rows = data.rows ?? [];
    if (rows.length === 0 && out.length === 0 && !data.more) return out;
    out.push(...rows);
    if (!data.more) break;
    const last = rows[rows.length - 1];
    if (!last) break;
    lowerBound = String(Number(last.id) + 1);
  }

  return out;
}
