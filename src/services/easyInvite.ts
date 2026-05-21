import { CHAIN_ENDPOINTS } from '@/services/walletConstants';

export const EASY_INVITE_CONTRACT = 'invite.mon3y';
export const EASY_INVITE_TOKEN_CONTRACT = 'mon3y';
export const EASY_INVITE_MIN_AMOUNT = 200;

export type EasyInviteAccountStatus = {
  account: string;
  exists: boolean;
  registered: boolean;
};

type GetAccountResponse = {
  account_name?: string;
  message?: string;
};

type GetTableRowsResponse = {
  rows?: Array<{ account?: string }>;
  message?: string;
};

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
