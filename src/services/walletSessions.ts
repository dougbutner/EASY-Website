/**
 * WebAuth: @proton/web-sdk v5 (XPR Network). Side-effect import keeps Proton Link (mobile / deep link) in the bundle.
 * Anchor: WharfKit SessionKit (default WebRenderer).
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
  stripProtonAnchorFromManifest,
  clearAllKeysForPrefix,
} from './walletManifest';
import {
  loginAnchor,
  logoutAllWharfSessions,
  logoutAnchorSession,
  restoreAllAnchorSessions,
  stableAnchorWalletId,
  transactAnchor,
} from './wharfSessionKit';

export type LoadedWebAuthWallet = WalletManifestEntry &
  ProtonSession & {
    provider: 'webauth';
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

export type LoadedWallet = LoadedWebAuthWallet | LoadedAnchorWallet;

export function walletActor(w: LoadedWallet): string {
  return w.provider === 'webauth' ? w.auth.actor : w.actor;
}

export function walletTypeLabel(w: LoadedWallet): string {
  return w.provider === 'anchor' || w.walletType === 'anchor'
    ? 'Anchor Wallet'
    : 'WebAuth';
}

async function connectWebAuthWallet(options: {
  storage: PrefixLinkStorage;
  restoreSession: boolean;
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
      walletType: 'webauth',
    },
    selectorOptions: {
      walletType: 'webauth',
      enabledWalletTypes: ['webauth'],
    },
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

function toLoadedWebAuth(entry: WalletManifestEntry, session: ProtonSession): LoadedWebAuthWallet {
  return {
    ...entry,
    ...session,
    provider: 'webauth',
    id: entry.id,
  };
}

function toLoadedAnchor(session: Session): LoadedAnchorWallet {
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

/** Run migrations, restore WebAuth + Anchor, return combined list. */
export async function restoreAllWallets(): Promise<LoadedWallet[]> {
  stripProtonAnchorFromManifest();
  migrateLegacyManifestIfNeeded();

  const manifest = loadManifest();
  const webAuthLoaded: LoadedWebAuthWallet[] = [];
  const updatedManifest: WalletManifestEntry[] = [];

  for (const entry of manifest) {
    const storage = new PrefixLinkStorage(entry.storagePrefix);
    const session = await connectWebAuthWallet({ storage, restoreSession: true });
    if (!session) continue;

    const walletType = (await storage.read('wallet-type')) ?? entry.walletType;
    const chainId = String(session.session?.chainId ?? '');
    const next: WalletManifestEntry = {
      ...entry,
      provider: 'webauth',
      actor: session.auth.actor,
      permission: session.auth.permission,
      chainId,
      walletType: walletType === 'webauth' ? 'webauth' : entry.walletType,
    };
    updatedManifest.push(next);
    webAuthLoaded.push(toLoadedWebAuth(next, session));
  }

  saveManifest(updatedManifest);

  const anchorSessions = await restoreAllAnchorSessions();
  const anchorLoaded = anchorSessions.map(toLoadedAnchor);

  return [...webAuthLoaded, ...anchorLoaded];
}

export async function connectNewWebAuthWallet(): Promise<LoadedWebAuthWallet | null> {
  const id = crypto.randomUUID();
  const storagePrefix = `xpr-forge-${id}`;
  const storage = new PrefixLinkStorage(storagePrefix);
  const session = await connectWebAuthWallet({ storage, restoreSession: false });
  if (!session) return null;

  const walletType = (await storage.read('wallet-type')) ?? 'webauth';
  const chainId = String(session.session?.chainId ?? '');
  const entry: WalletManifestEntry = {
    id,
    storagePrefix,
    actor: session.auth.actor,
    permission: session.auth.permission,
    chainId,
    walletType: walletType || 'webauth',
    provider: 'webauth',
  };
  const manifest = loadManifest();
  manifest.push(entry);
  saveManifest(manifest);
  return toLoadedWebAuth(entry, session);
}

export async function connectNewAnchorWallet(): Promise<LoadedAnchorWallet | null> {
  const session = await loginAnchor();
  if (!session) return null;
  return toLoadedAnchor(session);
}

export async function disconnectWallet(wallet: LoadedWallet): Promise<void> {
  if (wallet.provider === 'webauth') {
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
    if (w.provider === 'webauth') {
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
  if (wallet.provider === 'webauth') {
    return protonTransact(wallet, actions);
  }
  return transactAnchor(wallet.session, actions);
}

/**
 * Sign with Proton Web SDK (`@proton/web-sdk` session) and **do not broadcast** — Storex receives the signed
 * payload via `/V1/fireblocks/withdraw` (same flow as Storex’s WebAuth + `broadcast: false` example).
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
  if (wallet.provider !== 'webauth') {
    throw new Error('Storex bridge withdrawals require an active WebAuth wallet.');
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
