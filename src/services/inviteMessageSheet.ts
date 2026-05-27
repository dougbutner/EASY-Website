import type { InviteRequestMessage } from '@/services/easyInvite';

const SHEET_URL = import.meta.env.VITE_INVITE_MESSAGES_URL?.trim() ?? '';
const SHEET_SECRET = import.meta.env.VITE_INVITE_MESSAGES_SECRET?.trim() ?? '';

export function isInviteMessageSheetConfigured(): boolean {
  return SHEET_URL.length > 0;
}

function withSecret(params: URLSearchParams): URLSearchParams {
  if (SHEET_SECRET) params.set('secret', SHEET_SECRET);
  return params;
}

async function parseSheetJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error('Invite message service returned invalid JSON.');
  }
}

/** Append a request message (Google Sheet via Apps Script web app). */
export async function postInviteRequestMessage(
  account: string,
  requester: string,
  message: string
): Promise<{ ok: boolean; stored?: boolean }> {
  if (!isInviteMessageSheetConfigured()) return { ok: true, stored: false };

  const res = await fetch(SHEET_URL, {
    method: 'POST',
    redirect: 'follow',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      account,
      requester,
      message,
      secret: SHEET_SECRET || undefined,
    }),
  });

  const data = await parseSheetJson<{ ok?: boolean; stored?: boolean; error?: string }>(res);
  if (!data.ok) throw new Error(data.error || 'Failed to store invite message.');
  return { ok: true, stored: Boolean(data.stored) };
}

/** Latest message per account for the welcome queue table. */
export async function fetchInviteRequestMessagesFromSheet(
  accounts: string[]
): Promise<Map<string, InviteRequestMessage>> {
  const unique = [...new Set(accounts.map((a) => a.trim().toLowerCase()).filter(Boolean))];
  const map = new Map<string, InviteRequestMessage>();
  if (!unique.length || !isInviteMessageSheetConfigured()) return map;

  const params = withSecret(new URLSearchParams());
  params.set('accounts', unique.join(','));

  const res = await fetch(`${SHEET_URL}?${params.toString()}`);
  const data = await parseSheetJson<{
    ok?: boolean;
    messages?: InviteRequestMessage[];
    error?: string;
  }>(res);

  if (!data.ok) throw new Error(data.error || 'Failed to load invite messages.');

  for (const row of data.messages ?? []) {
    const account = row.account?.trim().toLowerCase();
    if (!account || !row.message) continue;
    map.set(account, {
      account,
      requester: row.requester?.trim().toLowerCase() ?? '',
      message: row.message,
      createdAt: row.createdAt ?? 0,
    });
  }
  return map;
}
