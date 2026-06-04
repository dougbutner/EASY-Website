import { CHAIN_ENDPOINTS } from '@/services/walletConstants';

export const EASY_INVITE_CONTRACT = 'invite.mon3y';
export const EASY_INVITE_TOKEN_CONTRACT = 'mon3y';
export const EASY_INVITE_MIN_AMOUNT = 200;
export const EASY_REWELCOME_MEMO = 'Welcome Back 🍹';
/** Unique downstream accounts counted for Welcome Back preview (matches on-chain capture depth). */
export const WELCOME_BACK_DOWNSTREAM_DEPTH = 7;

/** Same series as `easyinvite` contract `TETRAHEDRAL`. */
export const TETRAHEDRAL_THRESHOLDS = [
  1, 4, 10, 20, 35, 56, 84, 120, 165, 220, 286, 364, 455, 560, 680, 816, 969, 1140, 1330, 1540, 1771, 2024, 2300,
  2600, 999999999,
] as const;

/** Listed invite-score tiers shown in the Welcome economics table (excludes sentinel). */
export const TETRAHEDRAL_LISTED_TIER_COUNT = 24;
/** Rows rendered in the economics table before noting remaining tiers. */
export const TETRAHEDRAL_TABLE_ROW_COUNT = 22;
/** Maximum tetrahedral multiplier level on-chain. */
export const TETRAHEDRAL_MAX_LEVEL = 100;

function parseUintField(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, Math.floor(value));
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (Number.isFinite(n)) return Math.max(0, Math.floor(n));
  }
  return 0;
}

/** Tetrahedral level index used for Welcome Back pricing (matches on-chain). */
export function tetrahedralLevelFromScore(score: number): number {
  const s = parseUintField(score);
  for (let i = 0; i < TETRAHEDRAL_THRESHOLDS.length; i++) {
    if (TETRAHEDRAL_THRESHOLDS[i] > s) {
      const raw = i;
      return raw === 0 ? 1 : raw;
    }
  }
  return Math.max(1, TETRAHEDRAL_THRESHOLDS.length - 1);
}

export function welcomeBackMinimumEasy(score: number): number {
  return tetrahedralLevelFromScore(score) * EASY_INVITE_MIN_AMOUNT;
}

/**
 * Unique accounts in `rootAccount`'s downstream within `maxDepth` invite hops.
 * Each account is counted once even if Welcome Back created a loop in `invitedby`.
 */
export function countUniqueDownstreamFromAdopters(
  rootAccount: string,
  adopters: EasyInviteAdopter[],
  maxDepth = WELCOME_BACK_DOWNSTREAM_DEPTH
): number {
  const root = rootAccount.trim().toLowerCase();
  if (!root) return 0;

  const childrenByInviter = new Map<string, string[]>();
  for (const a of adopters) {
    const inv = a.invitedby?.trim().toLowerCase();
    if (!inv) continue;
    if (!childrenByInviter.has(inv)) childrenByInviter.set(inv, []);
    childrenByInviter.get(inv)!.push(a.account);
  }

  const seen = new Set<string>();
  let frontier = [root];
  for (let depth = 0; depth < maxDepth && frontier.length > 0; depth++) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const kid of childrenByInviter.get(id) ?? []) {
        if (seen.has(kid)) continue;
        seen.add(kid);
        next.push(kid);
      }
    }
    frontier = next;
  }
  return seen.size;
}

export type InviteRequestMessage = {
  account: string;
  requester: string;
  message: string;
  createdAt: number;
};

export type EasyInviteAccountStatus = {
  account: string;
  exists: boolean;
  registered: boolean;
};

export type EasyInviteAdopter = {
  account: string;
  invitedby: string;
  score: number;
  banked: string;
  lastupdated: number;
};

export type EasyInviteProgramStatus = {
  account: string;
  inProgram: boolean;
  score: number;
  banked: string;
  rank: number | null;
  totalMembers: number;
  invitedby: string;
};

export type EasyInviteRequest = {
  account: string;
  requester: string;
  requestedAt: number;
};

type InviteRequestRow = {
  account?: string;
  requester?: string;
  requested_at?: number;
};

type GetAccountResponse = {
  account_name?: string;
  message?: string;
};

type AdopterRow = {
  account?: string;
  invitedby?: string;
  score?: number;
  banked?: string;
  lastupdated?: number;
};

type GetTableRowsResponse = {
  rows?: AdopterRow[];
  more?: boolean;
  next_key?: string | number;
  message?: string;
};

function parseAdopterRow(row: AdopterRow): EasyInviteAdopter | null {
  const account = row.account?.trim();
  if (!account) return null;
  return {
    account,
    invitedby: row.invitedby?.trim() ?? '',
    score: parseUintField(row.score),
    banked: row.banked?.trim() ?? '0.000000 EASY',
    lastupdated: parseUintField(row.lastupdated),
  };
}

async function fetchAllAdoptersFromEndpoint(endpoint: string): Promise<EasyInviteAdopter[]> {
  const allRows: EasyInviteAdopter[] = [];
  let lowerBound: string | undefined;
  for (;;) {
    const page = await fetchAdoptersPage(endpoint, lowerBound);
    allRows.push(...page.rows);
    if (!page.more) break;
    if (page.nextKey !== undefined) {
      lowerBound = page.nextKey;
      continue;
    }
    const last = page.rows[page.rows.length - 1];
    if (!last) break;
    lowerBound = last.account;
  }
  return allRows;
}

async function fetchAdoptersPage(
  endpoint: string,
  lowerBound?: string
): Promise<{ rows: EasyInviteAdopter[]; more: boolean; nextKey?: string }> {
  const body: Record<string, unknown> = {
    json: true,
    code: EASY_INVITE_CONTRACT,
    scope: EASY_INVITE_CONTRACT,
    table: 'adopters',
    limit: 500,
  };
  if (lowerBound !== undefined) body.lower_bound = lowerBound;

  const res = await fetch(`${endpoint}/v1/chain/get_table_rows`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as GetTableRowsResponse;
  if (!res.ok) throw new Error(data.message || `Adopters table read failed (${res.status})`);

  const rows = (data.rows ?? [])
    .map(parseAdopterRow)
    .filter((row): row is EasyInviteAdopter => row !== null);

  return {
    rows,
    more: Boolean(data.more),
    nextKey: data.next_key !== undefined && data.next_key !== null ? String(data.next_key) : undefined,
  };
}

async function accountExistsAtEndpoint(account: string, endpoint: string): Promise<boolean> {
  const res = await fetch(`${endpoint}/v1/chain/get_account`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ account_name: account }),
  });
  const data = (await res.json().catch(() => ({}))) as GetAccountResponse;
  if (res.ok) return data.account_name === account;
  if (/unknown key|unknown account|not found/i.test(data.message ?? '')) return false;
  throw new Error(data.message || `Account check failed (${res.status})`);
}

async function adopterExistsAtEndpoint(account: string, endpoint: string): Promise<boolean> {
  const res = await fetch(`${endpoint}/v1/chain/get_table_rows`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      json: true,
      code: EASY_INVITE_CONTRACT,
      scope: EASY_INVITE_CONTRACT,
      table: 'adopters',
      lower_bound: account,
      limit: 1,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as GetTableRowsResponse;
  if (!res.ok) throw new Error(data.message || `Invite status check failed (${res.status})`);
  return (data.rows ?? []).some((row) => row.account === account);
}

export async function fetchEasyInviteAccountStatus(account: string): Promise<EasyInviteAccountStatus> {
  let lastError: Error | null = null;
  for (const endpoint of CHAIN_ENDPOINTS) {
    try {
      const exists = await accountExistsAtEndpoint(account, endpoint);
      const registered = exists ? await adopterExistsAtEndpoint(account, endpoint) : false;
      return { account, exists, registered };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }
  throw lastError ?? new Error('Unable to check invite account.');
}

export async function fetchEasyInviteAdopter(account: string): Promise<EasyInviteAdopter | null> {
  let lastError: Error | null = null;
  for (const endpoint of CHAIN_ENDPOINTS) {
    try {
      const res = await fetch(`${endpoint}/v1/chain/get_table_rows`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          json: true,
          code: EASY_INVITE_CONTRACT,
          scope: EASY_INVITE_CONTRACT,
          table: 'adopters',
          lower_bound: account,
          limit: 1,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as GetTableRowsResponse;
      if (!res.ok) throw new Error(data.message || `Adopter lookup failed (${res.status})`);
      const row = (data.rows ?? []).find((r) => r.account === account);
      return row ? parseAdopterRow(row) : null;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }
  throw lastError ?? new Error('Unable to load adopter row.');
}

/** Full `adopters` table from `invite.mon3y` (paginated). */
export async function fetchAllEasyInviteAdopters(): Promise<EasyInviteAdopter[]> {
  let lastError: Error | null = null;
  for (const endpoint of CHAIN_ENDPOINTS) {
    try {
      return await fetchAllAdoptersFromEndpoint(endpoint);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }
  throw lastError ?? new Error('Unable to load welcome network.');
}

export async function fetchEasyInviteProgramStatus(account: string): Promise<EasyInviteProgramStatus> {
  const normalized = account.trim().toLowerCase();
  if (!normalized) {
    throw new Error('Account is required.');
  }
  let lastError: Error | null = null;
  for (const endpoint of CHAIN_ENDPOINTS) {
    try {
      const allRows = await fetchAllAdoptersFromEndpoint(endpoint);

      allRows.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.account.localeCompare(b.account);
      });

      const idx = allRows.findIndex((row) => row.account === normalized);
      if (idx < 0) {
        return {
          account: normalized,
          inProgram: false,
          score: 0,
          banked: '0.000000 EASY',
          rank: null,
          totalMembers: allRows.length,
          invitedby: '',
        };
      }

      const self = allRows[idx];
      return {
        account: normalized,
        inProgram: true,
        score: self.score,
        banked: self.banked,
        rank: idx + 1,
        totalMembers: allRows.length,
        invitedby: self.invitedby,
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }
  throw lastError ?? new Error('Unable to load program status.');
}

/**
 * One paginated pass over `adopters`; returns direct invitees for each account in `inviters`.
 */
export async function fetchEasyInviteesByInviters(
  inviters: string[]
): Promise<Map<string, EasyInviteAdopter[]>> {
  const inviterSet = new Set(inviters);
  const grouped = new Map<string, EasyInviteAdopter[]>();
  for (const inv of inviters) grouped.set(inv, []);

  let lastError: Error | null = null;
  for (const endpoint of CHAIN_ENDPOINTS) {
    try {
      let lowerBound: string | undefined;
      for (;;) {
        const page = await fetchAdoptersPage(endpoint, lowerBound);
        for (const row of page.rows) {
          if (!inviterSet.has(row.invitedby)) continue;
          grouped.get(row.invitedby)!.push(row);
        }
        if (!page.more) break;
        if (page.nextKey !== undefined) {
          lowerBound = page.nextKey;
          continue;
        }
        const last = page.rows[page.rows.length - 1];
        if (!last) break;
        lowerBound = last.account;
      }
      return grouped;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }
  throw lastError ?? new Error('Unable to load invite connections.');
}

function parseInviteRequestRow(row: InviteRequestRow): EasyInviteRequest | null {
  const account = row.account?.trim();
  if (!account) return null;
  return {
    account,
    requester: row.requester?.trim() ?? '',
    requestedAt: parseUintField(row.requested_at),
  };
}

async function fetchInviteRequestsPage(
  endpoint: string,
  lowerBound?: string
): Promise<{ rows: EasyInviteRequest[]; more: boolean; nextKey?: string }> {
  const body: Record<string, unknown> = {
    json: true,
    code: EASY_INVITE_CONTRACT,
    scope: EASY_INVITE_CONTRACT,
    table: 'invrequests',
    limit: 500,
  };
  if (lowerBound !== undefined) body.lower_bound = lowerBound;

  const res = await fetch(`${endpoint}/v1/chain/get_table_rows`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as GetTableRowsResponse & {
    rows?: InviteRequestRow[];
  };
  if (!res.ok) throw new Error(data.message || `Invite requests read failed (${res.status})`);

  const rows = (data.rows ?? [])
    .map(parseInviteRequestRow)
    .filter((row): row is EasyInviteRequest => row !== null);

  return {
    rows,
    more: Boolean(data.more),
    nextKey: data.next_key !== undefined && data.next_key !== null ? String(data.next_key) : undefined,
  };
}

/** All rows in `invrequests` (FIFO welcome queue). */
export async function fetchEasyInviteRequests(): Promise<EasyInviteRequest[]> {
  let lastError: Error | null = null;
  for (const endpoint of CHAIN_ENDPOINTS) {
    try {
      const allRows: EasyInviteRequest[] = [];
      let lowerBound: string | undefined;
      for (;;) {
        const page = await fetchInviteRequestsPage(endpoint, lowerBound);
        allRows.push(...page.rows);
        if (!page.more) break;
        if (page.nextKey !== undefined) {
          lowerBound = page.nextKey;
          continue;
        }
        const last = page.rows[page.rows.length - 1];
        if (!last) break;
        lowerBound = last.account;
      }
      return allRows.sort((a, b) => a.requestedAt - b.requestedAt);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }
  throw lastError ?? new Error('Unable to load invite requests.');
}

/** Latest message per queued account (Google Sheet when configured). */
export { fetchInviteRequestMessagesFromSheet as fetchInviteRequestMessages } from '@/services/inviteMessageSheet';
