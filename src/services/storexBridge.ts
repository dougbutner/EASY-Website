import { CHAIN_ENDPOINTS } from '@/services/walletConstants';

export const EASY_SOLANA_MINT = '22pomM7dVyir9tE2Vkd1TtqaAkYeiPKAbSz2225LmAku';
export const EASY_BRIDGE_COIN = 'EASY';
export const EASY_BRIDGE_WALLET = 'SPL';
export const EASY_BRIDGE_CONTRACT = 'bridge.strx';
/** EASY on XPR for bridge `transfer` actions (Flex token contract). */
export const EASY_MON3Y_CONTRACT = 'mon3y';

/**
 * Storex `api.storex.io` CORS only allows `https://storex.io`, so the SPA must use a same-origin proxy:
 * - Local / preview: Vite `server.proxy` and `preview.proxy` (`/api/storex` → api.storex.io).
 * - Cloudflare Pages: `functions/_middleware.ts` (deploy from repo root with `wrangler pages deploy`).
 * - Apache (flex.town, etc.): `public/.htaccess` is copied to `dist/.htaccess` — enable mod_proxy and
 *   keep the `/api/storex/` proxy rules above any rewrite that sends traffic into `/dist/`.
 * Set `VITE_STOREX_API_BASE` to your own proxy origin if you host a different edge proxy.
 */
export function getStorexApiBase(): string {
  const raw = import.meta.env.VITE_STOREX_API_BASE as string | undefined;
  if (raw && String(raw).trim()) return String(raw).replace(/\/$/, '');
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/api/storex`;
  }
  return 'https://api.storex.io';
}

function storexFireblocksPath(suffix: string): string {
  const base = getStorexApiBase();
  const path = suffix.startsWith('/') ? suffix : `/${suffix}`;
  return `${base}${path}`;
}

export type StorexAddressRow = Record<string, unknown>;

export type DepositAddressResult = {
  address: string | null;
  rows: StorexAddressRow[];
};

export type BridgeFeeQuote = {
  quoteId: string;
  feeLabel: string;
  raw: Record<string, unknown>;
};

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function getFirstString(row: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = readString(row[key]);
    if (value) return value;
  }
  return null;
}

/**
 * On-chain `bridge.strx::addresses` uses `chain` (e.g. `"Solana"`). Fireblocks API uses `wallet: "SPL"` — treat both.
 */
function matchesEasySolanaDeposit(row: StorexAddressRow): boolean {
  const chain = getFirstString(row, ['chain', 'network', 'wallet', 'wallet_type']);
  if (!chain) return false;
  const c = chain.toLowerCase();
  if (c !== 'solana' && c !== 'spl') return false;

  const coin = getFirstString(row, ['coin', 'ticker', 'symbol', 'token']);
  if (coin && coin.toUpperCase() !== EASY_BRIDGE_COIN) return false;

  return true;
}

function addressFromRow(row: StorexAddressRow): string | null {
  return getFirstString(row, ['address', 'deposit_address', 'wallet_address', 'public_address']);
}

function extractAddress(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const root = payload as Record<string, unknown>;
  const direct = getFirstString(root, ['address', 'deposit_address', 'wallet_address', 'public_address']);
  if (direct) return direct;
  for (const key of ['data', 'result', 'wallet']) {
    const nested = root[key];
    if (nested && typeof nested === 'object') {
      const found = extractAddress(nested);
      if (found) return found;
    }
  }
  return null;
}

async function readJsonResponse(res: Response): Promise<Record<string, unknown>> {
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(readString(data.message) || readString(data.error) || `Storex request failed (${res.status})`);
  }
  return data;
}

async function fetchDepositRowsFromEndpoint(user: string, endpoint: string): Promise<StorexAddressRow[]> {
  const res = await fetch(`${endpoint}/v1/chain/get_table_rows`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      json: true,
      code: EASY_BRIDGE_CONTRACT,
      scope: EASY_BRIDGE_CONTRACT,
      table: 'addresses',
      index_position: 2,
      key_type: 'i64',
      lower_bound: user,
      upper_bound: user,
      limit: 999,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as { rows?: StorexAddressRow[]; message?: string };
  if (!res.ok) throw new Error(data.message || `RPC request failed (${res.status})`);
  return data.rows ?? [];
}

export async function fetchEasySolanaDepositAddress(user: string): Promise<DepositAddressResult> {
  let lastError: Error | null = null;
  for (const endpoint of CHAIN_ENDPOINTS) {
    try {
      const rows = await fetchDepositRowsFromEndpoint(user, endpoint);
      const address = rows.find(matchesEasySolanaDeposit);
      return {
        address: address ? addressFromRow(address) : null,
        rows,
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }
  throw lastError ?? new Error('Unable to fetch deposit addresses.');
}

export async function generateEasySolanaDepositAddress(user: string): Promise<string | null> {
  const res = await fetch(storexFireblocksPath('/V1/fireblocks/wallet/generate'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body: new URLSearchParams({
      user,
      coin: EASY_BRIDGE_COIN,
      wallet: EASY_BRIDGE_WALLET,
    }),
  });
  const data = await readJsonResponse(res);
  return extractAddress(data);
}

export async function estimateEasySolanaWithdrawalFee(user: string): Promise<BridgeFeeQuote> {
  const query = new URLSearchParams({
    user,
    coin: EASY_BRIDGE_COIN,
    wallet: EASY_BRIDGE_WALLET,
  });
  const res = await fetch(`${storexFireblocksPath('/V1/fireblocks/estimate-fee')}?${query.toString()}`);
  const data = await readJsonResponse(res);
  const quoteId =
    getFirstString(data, ['quoteId', 'quote_id', 'withdrawQuote', 'withdraw_quote', 'id']) ?? 'FIXED';
  const feeValue = getFirstString(data, ['fee', 'networkFee', 'network_fee', 'amount', 'quantity']);
  const feeLabel = feeValue ? `${feeValue} ${EASY_BRIDGE_COIN}` : 'Fee quote received';
  return { quoteId, feeLabel, raw: data };
}

function protonWithdrawFormFields(tx: Record<string, unknown>): Record<string, string> {
  const resolved = (tx.resolved ?? tx.request) as Record<string, unknown> | undefined;
  const serialized =
    resolved?.serializedTransaction ??
    tx.serializedTransaction ??
    tx.transaction ??
    (tx as { processed?: { packed_trx?: unknown } }).processed?.packed_trx;

  const signatures = tx.signatures ?? resolved?.signatures ?? [];
  const signer = tx.signer ?? tx.signerPublicKey ?? tx.signingKeys ?? {};
  const resolvedTransaction =
    tx.resolvedTransaction ?? resolved ?? (tx as { processed?: unknown }).processed ?? {};

  return {
    serializedTransaction: JSON.stringify(serialized ?? {}),
    signatures: JSON.stringify(Array.isArray(signatures) ? signatures : []),
    signer: JSON.stringify(typeof signer === 'object' && signer ? signer : {}),
    resolvedTransaction: JSON.stringify(
      typeof resolvedTransaction === 'string' ? resolvedTransaction : resolvedTransaction ?? {}
    ),
  };
}

export async function submitEasySolanaWithdrawal(args: {
  user: string;
  signedTransaction: Record<string, unknown>;
  withdrawQuote: string;
}): Promise<Record<string, unknown>> {
  const fields = protonWithdrawFormFields(args.signedTransaction);
  const res = await fetch(storexFireblocksPath('/V1/fireblocks/withdraw'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body: new URLSearchParams({
      user: args.user,
      ...fields,
      withdrawQuote: args.withdrawQuote,
    }),
  });
  return readJsonResponse(res);
}

export function formatEasyQuantity(amount: string): string {
  const numeric = Number(amount);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    throw new Error('Enter an EASY amount greater than 0.');
  }
  return `${numeric.toFixed(6)} EASY`;
}
