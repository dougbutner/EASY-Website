/**
 * Persisted list of @proton/web-sdk connections (WebAuth mobile/web + Anchor).
 * Each entry uses a distinct storage prefix so sessions stay isolated.
 * Legacy WharfKit Anchor sessions are stored separately by WharfKit.
 */
import type { LinkStorage } from '@proton/link';

export const MANIFEST_KEY = 'xpr-forge-wallet-manifest';
export const ACTIVE_WALLET_ID_KEY = 'xpr-forge-active-wallet-id';
/** Default prefix used by older single-session @proton/web-sdk installs */
export const LEGACY_STORAGE_PREFIX = 'proton-storage';

/** Rows persisted from ConnectWallet (XPR Network proton-web-sdk). */
export type ManifestProvider = 'proton-sdk';

export interface WalletManifestEntry {
  id: string;
  storagePrefix: string;
  actor: string;
  permission: string;
  chainId: string;
  /** From SDK storage `wallet-type`: mobile WebAuth, desktop WebAuth popup, or Anchor (ESR). */
  walletType: 'proton' | 'webauth' | 'anchor';
  provider: ManifestProvider;
}

/** Same key layout as @proton/web-sdk Storage */
export class PrefixLinkStorage implements LinkStorage {
  constructor(readonly keyPrefix: string) {}

  async write(key: string, data: string): Promise<void> {
    localStorage.setItem(this.storageKey(key), data);
  }

  async read(key: string): Promise<string | null> {
    return localStorage.getItem(this.storageKey(key));
  }

  async remove(key: string): Promise<void> {
    localStorage.removeItem(this.storageKey(key));
  }

  storageKey(key: string): string {
    return `${this.keyPrefix}-${key}`;
  }
}

export function loadManifest(): WalletManifestEntry[] {
  try {
    const raw = localStorage.getItem(MANIFEST_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isManifestEntry).map((e) => ({
      ...e,
      provider: 'proton-sdk',
      walletType: normalizeWalletType(
        typeof e.walletType === 'string' ? e.walletType : 'webauth'
      ),
    }));
  } catch {
    return [];
  }
}

function normalizeWalletType(wt: string): WalletManifestEntry['walletType'] {
  const t = wt.toLowerCase();
  if (t === 'proton' || t === 'webauth' || t === 'anchor') return t;
  return 'webauth';
}

export function saveManifest(entries: WalletManifestEntry[]): void {
  localStorage.setItem(MANIFEST_KEY, JSON.stringify(entries));
}

export function getActiveWalletId(): string | null {
  return localStorage.getItem(ACTIVE_WALLET_ID_KEY);
}

export function setActiveWalletId(id: string | null): void {
  if (id === null) localStorage.removeItem(ACTIVE_WALLET_ID_KEY);
  else localStorage.setItem(ACTIVE_WALLET_ID_KEY, id);
}

/** If manifest is empty but legacy proton-storage keys exist, seed one WebAuth entry. */
export function migrateLegacyManifestIfNeeded(): void {
  if (loadManifest().length > 0) return;
  const ua = localStorage.getItem(`${LEGACY_STORAGE_PREFIX}-user-auth`);
  if (!ua) return;
  let actor = '';
  let permission = '';
  try {
    const auth = JSON.parse(ua) as { actor?: string; permission?: string };
    actor = auth.actor ?? '';
    permission = auth.permission ?? '';
  } catch {
    /* ignore */
  }
  const walletType = localStorage.getItem(`${LEGACY_STORAGE_PREFIX}-wallet-type`) ?? 'webauth';
  if (walletType === 'anchor') {
    clearAllKeysForPrefix(LEGACY_STORAGE_PREFIX);
    return;
  }
  const id = crypto.randomUUID();
  saveManifest([
    {
      id,
      storagePrefix: LEGACY_STORAGE_PREFIX,
      actor,
      permission,
      chainId: '',
      walletType: normalizeWalletType(walletType),
      provider: 'proton-sdk',
    },
  ]);
}

export function clearAllKeysForPrefix(prefix: string): void {
  const suffix = `${prefix}-`;
  const toRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(suffix)) toRemove.push(k);
  }
  for (const k of toRemove) localStorage.removeItem(k);
}

function isManifestEntry(x: unknown): x is Omit<WalletManifestEntry, 'provider' | 'walletType'> & {
  provider?: string;
  walletType?: string;
} {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  const provider = o.provider;
  if (provider !== undefined && provider !== 'proton-sdk' && provider !== 'webauth') return false;
  const wt = typeof o.walletType === 'string' ? o.walletType.toLowerCase() : '';
  if (wt && wt !== 'proton' && wt !== 'webauth' && wt !== 'anchor') return false;
  return (
    typeof o.id === 'string' &&
    typeof o.storagePrefix === 'string' &&
    typeof o.actor === 'string' &&
    typeof o.permission === 'string' &&
    typeof o.chainId === 'string'
  );
}
