import { CHAIN_ENDPOINTS } from '@/services/walletConstants';

type FlexerRow = {
  owner?: string;
  balance?: string;
};

type GetTableRowsResponse = {
  rows?: FlexerRow[];
  message?: string;
};

/**
 * Primary-key bounds for `get_table_rows` when the key is an account `name`.
 * All-numeric XPR names (digits 1–5 only) must be suffixed so the RPC parses them as names, not raw u64.
 */
export function flexTableKeyBound(name: string): string {
  return /^[1-5]+$/.test(name) ? `${name}.` : name;
}

/**
 * Reflection-tracked balance for a holder on flex contracts (`flexers` table, scope = contract).
 * On-chain this is separate from liquid `accounts` (scope = holder); `flexers.balance` is what
 * `distribute` / `radiate` / `reflect` iterate for payouts.
 */
async function fetchFlexersBalanceFromEndpoint(
  contract: string,
  owner: string,
  endpoint: string
): Promise<string | null> {
  const lo = flexTableKeyBound(owner);
  const hi = flexTableKeyBound(owner);

  const res = await fetch(`${endpoint}/v1/chain/get_table_rows`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      json: true,
      code: contract,
      scope: contract,
      table: 'flexers',
      lower_bound: lo,
      upper_bound: hi,
      limit: 10,
    }),
  });
  const data = (await res.json()) as GetTableRowsResponse;
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);

  const row = (data.rows ?? []).find((r) => r.owner === owner);
  const bal = row?.balance;
  return typeof bal === 'string' && bal.trim().length > 0 ? bal.trim() : null;
}

export async function fetchFlexersBalance(contract: string, owner: string): Promise<string | null> {
  let lastError: Error | null = null;
  for (const endpoint of CHAIN_ENDPOINTS) {
    try {
      return await fetchFlexersBalanceFromEndpoint(contract, owner, endpoint);
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
    }
  }
  console.warn('flexFlexerBalance:', lastError?.message ?? 'unknown error');
  return null;
}
