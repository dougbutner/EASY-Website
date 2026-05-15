/**
 * XPR Network @proton/web-sdk v5 — official ConnectWallet flow:
 * - `proton` = WebAuth mobile (ProtonLink; app / deep link — not the webauth.com popup)
 * - `webauth` = WebAuth desktop (ProtonWebLink → webauth.com)
 * - `anchor` = Anchor (ProtonLink + ESR)
 *
 * Legacy Anchor sessions created with WharfKit are still restored until the user disconnects.
 */
import '@proton/link';
import ConnectWallet, { type ConnectWalletRet } from '@proton/web-sdk';
import type { Session } from '@wharfkit/session';
import type { ProtonSession } from './proton';
import { transact as protonTransact } from './proton';
import {
  APP_NAME,
  APP_LOGO_PUBLIC_PATH,
  REQUEST_ACCOUNT,
  CHAIN_ENDPOINTS,
  XPR_CHAIN_ID_HEX,
} from './walletConstants';
import {
  loadManifest,
  saveManifest,
  setActiveWalletId,
  type WalletManifestEntry,
  PrefixLinkStorage,
  migrateLegacyManifestIfNeeded,
  clearAllKeysForPrefix,
} from './walletManifest';
import {
  logoutAllWharfSessions,
  logoutAnchorSession,
  restoreAllAnchorSessions,
  stableAnchorWalletId,
  transactAnchor,
} from './wharfSessionKit';

export type LoadedProtonSdkWallet = WalletManifestEntry &
  ProtonSession & {
    provider: 'proton-sdk';
    id: string;
  };

export type LoadedAnchorWallet = {
  provider: 'anchor';
  id: string;
  session: Session;
  actor: string;
  permission: string;
  chainId: string;
  walletType: 'anchor';
};

export type LoadedWallet = LoadedProtonSdkWallet | LoadedAnchorWallet;

/** WebAuth mobile or desktop via proton-web-sdk (not SDK Anchor). */
export function isStorexWebAuthSigner(wallet: LoadedWallet): boolean {
  return wallet.provider === 'proton-sdk' && wallet.walletType !== 'anchor';
}

export function walletActor(w: LoadedWallet): string {
  return w.provider === 'proton-sdk' ? w.auth.actor : w.actor;
}

export function walletTypeLabel(w: LoadedWallet): string {
  if (w.provider === 'anchor') return 'Anchor';
  if (w.provider === 'proton-sdk' && w.walletType === 'anchor') return 'Anchor';
  if (w.provider === 'proton-sdk' && w.walletType === 'proton') return 'WebAuth (app)';
  return 'WebAuth';
}

type SdkConnectMode = 'restore' | 'webauth-variants' | 'anchor' | 'all';

function selectorOptionsForMode(mode: SdkConnectMode) {
  switch (mode) {
    case 'restore':
      return {};
    case 'webauth-variants':
      return { enabledWalletTypes: ['proton', 'webauth'] as const };
    case 'anchor':
      return { walletType: 'anchor' as const };
    case 'all':
      return { enabledWalletTypes: ['proton', 'webauth', 'anchor'] as const };
    default:
      return {};
  }
}

async function connectProtonSdkWallet(options: {
  storage: PrefixLinkStorage;
  restoreSession: boolean;
  mode: SdkConnectMode;
}): Promise<ProtonSession | null> {
  const appLogo =
    typeof window !== 'undefined'
      ? new URL(APP_LOGO_PUBLIC_PATH, window.location.origin).href
      : undefined;

  const res: ConnectWalletRet = await ConnectWallet({
    linkOptions: {
      endpoints: CHAIN_ENDPOINTS,
      chainId: XPR_CHAIN_ID_HEX,
      storage: options.storage,
      restoreSession: options.restoreSession,
    },
    transportOptions: {
      requestAccount: REQUEST_ACCOUNT,
    },
    selectorOptions: selectorOptionsForMode(options.mode),
    uiOptions: {
      theme: 'dark',
      appInfo: {
        name: APP_NAME,
        ...(appLogo ? { logo: appLogo, logoRounded: true } : {}),
      },
    },
  });

  if (res.error) {
    console.error('ConnectWallet error:', res.error);
    return null;
  }
  if (!res.session || !res.link) return null;

  const { session, link } = res;

  return {
    auth: {
      actor: String(session.auth.actor),
      permission: String(session.auth.permission),
    },
    link,
    session,
  };
}

function toLoadedProtonSdk(entry: WalletManifestEntry, session: ProtonSession): LoadedProtonSdkWallet {
  return {
    ...entry,
    ...session,
    provider: 'proton-sdk',
    id: entry.id,
  };
}

function toLoadedWharfAnchor(session: Session): LoadedAnchorWallet {
  return {
    provider: 'anchor',
    id: stableAnchorWalletId(session),
    session,
    actor: String(session.actor),
    permission: String(session.permission),
    chainId: String(session.chain.id),
    walletType: 'anchor',
  };
}

/** Run migrations, restore proton-web-sdk manifest + legacy Wharf Anchor. */
export async function restoreAllWallets(): Promise<LoadedWallet[]> {
  migrateLegacyManifestIfNeeded();

  const manifest = loadManifest();
  const sdkLoaded: LoadedProtonSdkWallet[] = [];
  const updatedManifest: WalletManifestEntry[] = [];

  for (const entry of manifest) {
    const storage = new PrefixLinkStorage(entry.storagePrefix);
    const session = await connectProtonSdkWallet({
      storage,
      restoreSession: true,
      mode: 'restore',
    });
    if (!session) continue;

    const walletTypeRaw = (await storage.read('wallet-type')) ?? entry.walletType;
    const walletType = normalizeStoredWalletType(walletTypeRaw, entry.walletType);
    const chainId = String(session.session?.chainId ?? '');
    const next: WalletManifestEntry = {
      ...entry,
      provider: 'proton-sdk',
      actor: session.auth.actor,
      permission: session.auth.permission,
      chainId,
      walletType,
    };
    updatedManifest.push(next);
    sdkLoaded.push(toLoadedProtonSdk(next, session));
  }

  saveManifest(updatedManifest);

  const anchorSessions = await restoreAllAnchorSessions();
  const wharfLoaded = anchorSessions.map(toLoadedWharfAnchor);

  return [...sdkLoaded, ...wharfLoaded];
}

function normalizeStoredWalletType(
  raw: string | null,
  fallback: WalletManifestEntry['walletType']
): WalletManifestEntry['walletType'] {
  const t = (raw ?? fallback).toLowerCase();
  if (t === 'proton' || t === 'webauth' || t === 'anchor') return t;
  return fallback;
}

export async function connectNewXprWallet(): Promise<LoadedProtonSdkWallet | null> {
  return connectNewProtonSdkEntry('all');
}

export async function connectNewWebAuthWallet(): Promise<LoadedProtonSdkWallet | null> {
  return connectNewProtonSdkEntry('webauth-variants');
}

export async function connectNewAnchorWallet(): Promise<LoadedProtonSdkWallet | null> {
  const id = crypto.randomUUID();
  const storagePrefix = `xpr-forge-${id}`;
  const storage = new PrefixLinkStorage(storagePrefix);
  const session = await connectProtonSdkWallet({
    storage,
    restoreSession: false,
    mode: 'anchor',
  });
  if (!session) return null;

  const walletType = normalizeStoredWalletType(await storage.read('wallet-type'), 'anchor');
  const chainId = String(session.session?.chainId ?? '');
  const entry: WalletManifestEntry = {
    id,
    storagePrefix,
    actor: session.auth.actor,
    permission: session.auth.permission,
    chainId,
    walletType,
    provider: 'proton-sdk',
  };
  const manifest = loadManifest();
  manifest.push(entry);
  saveManifest(manifest);
  return toLoadedProtonSdk(entry, session);
}

async function connectNewProtonSdkEntry(
  mode: 'webauth-variants' | 'all'
): Promise<LoadedProtonSdkWallet | null> {
  const id = crypto.randomUUID();
  const storagePrefix = `xpr-forge-${id}`;
  const storage = new PrefixLinkStorage(storagePrefix);
  const session = await connectProtonSdkWallet({
    storage,
    restoreSession: false,
    mode,
  });
  if (!session) return null;

  const walletType = normalizeStoredWalletType(await storage.read('wallet-type'), 'webauth');
  const chainId = String(session.session?.chainId ?? '');
  const entry: WalletManifestEntry = {
    id,
    storagePrefix,
    actor: session.auth.actor,
    permission: session.auth.permission,
    chainId,
    walletType,
    provider: 'proton-sdk',
  };
  const manifest = loadManifest();
  manifest.push(entry);
  saveManifest(manifest);
  return toLoadedProtonSdk(entry, session);
}

export async function disconnectWallet(wallet: LoadedWallet): Promise<void> {
  if (wallet.provider === 'proton-sdk') {
    try {
      await wallet.link.removeSession(REQUEST_ACCOUNT, wallet.session.auth, wallet.session.chainId);
    } catch (err) {
      console.error('removeSession failed:', err);
    }
    const next = loadManifest().filter((e) => e.id !== wallet.id);
    saveManifest(next);
    clearAllKeysForPrefix(wallet.storagePrefix);
  } else {
    await logoutAnchorSession(wallet.session);
  }
}

export async function disconnectAllWallets(wallets: LoadedWallet[]): Promise<void> {
  for (const w of wallets) {
    if (w.provider === 'proton-sdk') {
      try {
        await w.link.removeSession(REQUEST_ACCOUNT, w.session.auth, w.session.chainId);
      } catch (err) {
        console.error('removeSession failed:', err);
      }
      clearAllKeysForPrefix(w.storagePrefix);
    }
  }
  saveManifest([]);
  await logoutAllWharfSessions();
  setActiveWalletId(null);
}

export async function transactWithWallet(
  wallet: LoadedWallet,
  actions: Array<{
    account: string;
    name: string;
    data: Record<string, unknown>;
    authorization?: Array<{ actor: string; permission: string }>;
  }>
) {
  if (wallet.provider === 'proton-sdk') {
    return protonTransact(wallet, actions);
  }
  return transactAnchor(wallet.session, actions);
}

/**
 * Sign with Proton Web SDK session and **do not broadcast** — Storex receives the signed
 * payload via `/V1/fireblocks/withdraw`.
 */
export async function signUnbroadcastWebAuthTransaction(
  wallet: LoadedWallet,
  actions: Array<{
    account: string;
    name: string;
    data: Record<string, unknown>;
    authorization?: Array<{ actor: string; permission: string }>;
  }>
): Promise<Record<string, unknown>> {
  if (!isStorexWebAuthSigner(wallet)) {
    throw new Error('Storex bridge withdrawals require WebAuth (app or web), not Anchor.');
  }

  const filledActions = actions.map((action) => ({
    ...action,
    authorization: action.authorization || [
      {
        actor: wallet.auth.actor,
        permission: wallet.auth.permission,
      },
    ],
  }));

  return (await wallet.session.transact(
    { actions: filledActions },
    { broadcast: false }
  )) as Record<string, unknown>;
}
