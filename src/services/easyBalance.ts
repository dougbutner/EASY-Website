import { CHAIN_ENDPOINTS } from '@/services/walletConstants';
import { EASY_MON3Y_CONTRACT } from '@/services/storexBridge';

export const EASY_DECIMALS = 6;
export const EASY_SYMBOL_CODE = 'EASY';

export type BridgeEasySnapshot = {
  balance: number;
};

function parseEasyBalanceString(line: string): number | null {
  const m = String(line).trim().match(/^([\d.]+)\s+EASY$/i);
  if (!m) return null;
  const n = Number.parseFloat(m[1]);
  return Number.isFinite(n) ? n : null;
}

async function fetchEasyViaCurrencyBalance(
  endpoint: string,
  code: string,
  account: string
): Promise<number | null> {
  const bodies: Record<string, unknown>[] = [
    { code, account, symbol: EASY_SYMBOL_CODE },
    { code, account, symbol: `${EASY_DECIMALS},${EASY_SYMBOL_CODE}` },
  ];
  for (const body of bodies) {
    const res = await fetch(`${endpoint}/v1/chain/get_currency_balance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => null)) as unknown;
    if (!res.ok) continue;
    if (Array.isArray(data) && data.length > 0) {
      const parsed = parseEasyBalanceString(String(data[0]));
      if (parsed !== null) return parsed;
    }
  }

  const resAll = await fetch(`${endpoint}/v1/chain/get_currency_balance`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, account }),
  });
  const list = (await resAll.json().catch(() => null)) as unknown;
  if (resAll.ok && Array.isArray(list)) {
    for (const line of list) {
      const parsed = parseEasyBalanceString(String(line));
      if (parsed !== null) return parsed;
    }
  }
  return null;
}

async function fetchEasyViaAccountsTable(
  endpoint: string,
  code: string,
  account: string
): Promise<number | null> {
  const res = await fetch(`${endpoint}/v1/chain/get_table_rows`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      json: true,
      code,
      scope: account,
      table: 'accounts',
      limit: 500,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as { rows?: Array<{ balance?: string }>; message?: string };
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  for (const row of data.rows ?? []) {
    const parsed = parseEasyBalanceString(String(row.balance ?? ''));
    if (parsed !== null) return parsed;
  }
  return null;
}

async function readEasyOnContract(
  endpoint: string,
  code: string,
  account: string
): Promise<number> {
  const viaCur = await fetchEasyViaCurrencyBalance(endpoint, code, account);
  if (viaCur !== null) return viaCur;
  const viaTbl = await fetchEasyViaAccountsTable(endpoint, code, account);
  return viaTbl ?? 0;
}

async function readEasyOnContractFromAnyEndpoint(code: string, account: string): Promise<number> {
  let lastError: Error | null = null;
  for (const endpoint of CHAIN_ENDPOINTS) {
    try {
      return await readEasyOnContract(endpoint, code, account);
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw lastError ?? new Error('Unable to read EASY balance.');
}

async function safeReadEasy(code: string, account: string): Promise<number> {
  try {
    return await readEasyOnContractFromAnyEndpoint(code, account);
  } catch {
    return 0;
  }
}

/** EASY balance on `mon3y` for the active XPR account (bridge + Max). */
export async function fetchBridgeEasySnapshot(account: string): Promise<BridgeEasySnapshot> {
  const balance = await safeReadEasy(EASY_MON3Y_CONTRACT, account);
  return { balance };
}
