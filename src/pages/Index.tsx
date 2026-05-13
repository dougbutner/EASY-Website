/**
 * Index page — EASY one-page snap-scroll landing and token tools.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Header } from '@/components/Header';
import { JupiterEasyPlugin } from '@/components/JupiterEasyPlugin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { pickRandomWonVariant, TOKEN_LOGO } from '@/constants/tokenAssets';
import { useProton } from '@/hooks/useProton';
import { cn } from '@/lib/utils';
import {
  fetchFlexPools,
  flexPoolLabel,
  flexPoolRewardSymbol,
  type FlexPoolRow,
} from '@/services/flexPools';
import { fetchFlexersBalance } from '@/services/flexFlexerBalance';
import {
  EASY_BRIDGE_CONTRACT,
  EASY_BRIDGE_WALLET,
  EASY_MON3Y_CONTRACT,
  EASY_SOLANA_MINT,
  fetchEasySolanaDepositAddress,
  formatEasyQuantity,
  generateEasySolanaDepositAddress,
  submitEasySolanaWithdrawal,
} from '@/services/storexBridge';
import { fetchBridgeEasySnapshot, type BridgeEasySnapshot } from '@/services/easyBalance';
import { signUnbroadcastWebAuthTransaction } from '@/services/walletSessions';
import {
  ExternalLink,
  Globe2,
  Network,
  Send,
  Sparkles,
  Sprout,
  TreePine,
} from 'lucide-react';
import { toast } from 'sonner';

/** Sonner default is ~4s; keep success toasts at least 6s and 3s longer than that baseline. */
const BROADCAST_SUCCESS_TOAST_MS = Math.max(6000, 4000 + 3000);

function extractBroadcastTxId(result: unknown): string | null {
  if (!result || typeof result !== 'object') return null;
  const o = result as Record<string, unknown>;

  const idFromProcessed = (processed: unknown): string | null => {
    if (!processed || typeof processed !== 'object') return null;
    const id = (processed as Record<string, unknown>).id;
    return typeof id === 'string' && id.trim().length > 0 ? id.trim() : null;
  };

  const direct = idFromProcessed(o.processed);
  if (direct) return direct;

  const response = o.response;
  if (response && typeof response === 'object') {
    const nested = idFromProcessed((response as Record<string, unknown>).processed);
    if (nested) return nested;
  }

  return null;
}

function xprTransactionExplorerUrl(txId: string) {
  return `https://explorer.xprnetwork.org/transaction/${encodeURIComponent(txId)}`;
}

type FlexAction = {
  account: string;
  name: string;
  data: Record<string, unknown>;
};

type TokenConfig = {
  symbol: string;
  contract: string;
  title: string;
  tagline: string;
  summary: string;
  tax: string;
  minHold: string;
  dexToken: string;
  analyticsUrl: string;
  explorerUrl: string;
  sendAction: string;
  rewardAction: string;
  optOutAction: string;
  treeAction?: string;
  memoAction?: string;
  /** Public URL under `/assets/tokens/`. Omit for WON — a random variant is picked once per page load. */
  logoPath?: string;
};

const navItems = [
  { id: 'tools', label: 'Flex town' },
  { id: 'flex-tools', label: 'Flex Tools' },
  { id: 'what', label: 'What Is EASY' },
  { id: 'money', label: 'Finance' },
  { id: 'price', label: 'Trade' },
  { id: 'swap', label: 'Swap' },
  { id: 'works', label: 'How It Works' },
  { id: 'tokens', label: 'Core Flex' },
  { id: 'fringe', label: 'Fringe' },
  { id: 'solana', label: 'Solana' },
  { id: 'bridge', label: 'Bridge' },
];

const tokens: TokenConfig[] = [
  {
    symbol: 'EASY',
    contract: 'mon3y',
    title: 'Take it EASY 🍹',
    tagline: 'The keystone customizable-reflection neo+.',
    summary: 'A fair-launched token backed by ranged liquidity and automatic holder rewards.',
    tax: '2% reflection',
    minHold: '100+ EASY',
    dexToken: 'EASY-mon3y',
    analyticsUrl: 'https://alcor.exchange/v/xpr/analytics/tokens/easy-mon3y',
    explorerUrl: 'https://explorer.xprnetwork.org/account/mon3y?loadContract=true&tab=actions&account=mon3y&scope=mon3y&limit=100',
    logoPath: TOKEN_LOGO.EASY,
    sendAction: 'distribute',
    rewardAction: 'setflextoken',
    optOutAction: 'noflexzone',
  },
  {
    symbol: 'WON',
    contract: 'w3won',
    title: 'We WON ⓦ',
    tagline: 'EASY-backed reflections for ecovillage tokenization.',
    summary: 'WON routes reflections and a project budget toward real-world community work.',
    tax: '2.2% reflection + 0.8% team',
    minHold: '1+ WON',
    dexToken: 'WON-w3won',
    analyticsUrl: 'https://alcor.exchange/v/xpr/analytics/tokens/won-w3won',
    explorerUrl: 'https://explorer.xprnetwork.org/account/w3won?loadContract=true&tab=actions&account=w3won&scope=w3won&limit=100',
    sendAction: 'radiate',
    rewardAction: 'sprouttoken',
    optOutAction: 'optoutoftax',
    treeAction: 'settree',
    memoAction: 'settreememo',
  },
  {
    symbol: 'GRAMS',
    contract: 'gold.mon3y',
    title: 'Golden GRAMS',
    tagline: 'A Flex-token family member with inheritance-style routing.',
    summary: 'GRAMS uses its own action names for reward choice, tax opt-out, and inheritance.',
    tax: '1.1% reflection',
    minHold: '0.1 GRAMS',
    dexToken: 'GRAMS-gold.mon3y',
    analyticsUrl: 'https://alcor.exchange/v/xpr/analytics/tokens/grams-gold.mon3y',
    explorerUrl: 'https://explorer.xprnetwork.org/account/gold.mon3y?loadContract=true&tab=actions&account=gold.mon3y&scope=gold.mon3y&limit=100',
    logoPath: TOKEN_LOGO.GRAMS,
    sendAction: 'reflect',
    rewardAction: 'interestoken',
    optOutAction: 'renounce',
    treeAction: 'inheritance',
    memoAction: 'inheritmemo',
  },
  {
    symbol: 'MEME',
    contract: 'm3m3',
    title: 'GM Degens 🍦',
    tagline: 'The burn-heavy Flex token for farms, culture, and laughs.',
    summary: 'MEME splits activity between holder reflections and supply burn mechanics.',
    tax: '1% reflection + 1% burn',
    minHold: '1M+ MEME',
    dexToken: 'MEME-m3m3',
    analyticsUrl: 'https://alcor.exchange/v/xpr/analytics/tokens/meme-m3m3',
    explorerUrl: 'https://explorer.xprnetwork.org/account/m3m3?loadContract=true&tab=actions&account=m3m3&scope=m3m3&limit=100',
    logoPath: TOKEN_LOGO.MEME,
    sendAction: 'distribute',
    rewardAction: 'setflextoken',
    optOutAction: 'noflexzone',
  },
];

const WON_GRAMS_BENEFICIARY_UI = new Set(['WON', 'GRAMS']);

const DEFAULT_FLEX_BENEFIT_MEMO: Partial<Record<string, string>> = {
  WON: "Blessings @@. I've passed some of my rewards to you $$ ** I get from WON",
  GRAMS: "Blessings @@. I've passed some of my rewards to you $$ ** I get from GRAMS",
};

const FLEX_MEMO_INTRO =
  'Create a custom memo to activate other contracts, or just say hello.';

/** Rough on-chain guide for ~1 minute of reflection accrual in `flexers` pending (approximate). */
const FLEX_REFLECTION_MIN_NOTE =
  'Rough guide for ~1 min of reflection in pending: about 8 WON, 0.1 GRAMS, 1,000 EASY, or 10M MEME (pool + activity dependent).';

const featureCards = [
  {
    image: TOKEN_LOGO.EASY,
    title: 'Send Rewards',
    body: 'Run the token distribution call and use your CPU to push pending reflections to holders.',
  },
  {
    image: TOKEN_LOGO.GRAMS,
    title: 'Change Reward Token',
    body: 'Choose what your reflections buy: EASY, GRAMS, MEME, BTC-style wrapped assets, or the token a pool supports.',
  },
  {
    image: TOKEN_LOGO.MEME,
    title: 'Opt Out of Tax',
    body: 'Call the token-specific opt-out action when an account needs to skip tax and rewards.',
  },
];

/** Swap UI (`/swap`, `/swap-widget`) uses proton.alcor.exchange for reliable token loading; other Alcor links/embeds use `alcor.exchange/v/xpr/...`. */
const alcorEasySwap = 'https://proton.alcor.exchange/swap?input=XUSDC-xtokens&output=EASY-mon3y';
const alcorEasySpotTrade = 'https://alcor.exchange/v/xpr/trade/easy-mon3y_xusdc-xtokens';
const alcorEasySwapWidget = 'https://proton.alcor.exchange/swap-widget?input=XUSDC-xtokens&output=EASY-mon3y';
const jupiterEasySwap = `https://jup.ag/swap/SOL-${EASY_SOLANA_MINT}`;

/** Storex withdraw API expects a quote id; fixed fee path uses this literal. */
const BRIDGE_WITHDRAW_QUOTE_ID = 'FIXED';
/** Shown in UI; XPR → Solana bridge fee (EASY). */
const BRIDGE_FEE_XPR_TO_SOLANA_EASY = 25;

function tokenLogoUrl(token: TokenConfig, wonRandom: string): string {
  if (token.symbol === 'WON') return wonRandom;
  return token.logoPath ?? TOKEN_LOGO.EASY;
}

const Index = () => {
  const {
    actor,
    isLoggedIn,
    loading,
    wallets,
    activeId,
    addWebAuthWallet,
    addAnchorWallet,
    setActive,
    removeWallet,
    disconnectAll,
    transact,
    activeWallet,
  } = useProton();
  const [activeSection, setActiveSection] = useState(navItems[0].id);
  const [selectedSymbol, setSelectedSymbol] = useState('EASY');
  const [rewardSymbol, setRewardSymbol] = useState('EASY');
  const [treeAccount, setTreeAccount] = useState('');
  const [treeRate, setTreeRate] = useState('10000');
  const [customMemo, setCustomMemo] = useState(
    () => DEFAULT_FLEX_BENEFIT_MEMO.WON ?? ''
  );
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [poolsByContract, setPoolsByContract] = useState<Record<string, FlexPoolRow[]>>({});
  const [selectedPoolRowId, setSelectedPoolRowId] = useState<string | null>(null);
  const [loadingPools, setLoadingPools] = useState(false);
  const [bridgeLoading, setBridgeLoading] = useState<string | null>(null);
  const [bridgeDepositAddress, setBridgeDepositAddress] = useState<string | null>(null);
  const [bridgeWithdrawAddress, setBridgeWithdrawAddress] = useState('');
  const [bridgeWithdrawAmount, setBridgeWithdrawAmount] = useState('');
  const [bridgeEasySnap, setBridgeEasySnap] = useState<BridgeEasySnapshot | null>(null);
  const [bridgeBalanceLoading, setBridgeBalanceLoading] = useState(false);
  const [flexerBalanceBySymbol, setFlexerBalanceBySymbol] = useState<Record<string, string | null>>({});
  const [flexerBalanceLoading, setFlexerBalanceLoading] = useState(false);
  const [flexerEpoch, setFlexerEpoch] = useState(0);
  const mainRef = useRef<HTMLElement>(null);
  const [wonLogoUrl] = useState(() => pickRandomWonVariant());

  const selectedToken = useMemo(
    () => tokens.find((token) => token.symbol === selectedSymbol) ?? tokens[0],
    [selectedSymbol]
  );

  const beneficiaryUi = WON_GRAMS_BENEFICIARY_UI.has(selectedToken.symbol);

  useEffect(() => {
    const next = DEFAULT_FLEX_BENEFIT_MEMO[selectedSymbol];
    if (next !== undefined) setCustomMemo(next);
  }, [selectedSymbol]);

  useEffect(() => {
    if (loading || !actor) {
      setFlexerBalanceBySymbol({});
      setFlexerBalanceLoading(false);
      return;
    }
    let cancelled = false;
    setFlexerBalanceBySymbol({});
    setFlexerBalanceLoading(true);
    void (async () => {
      try {
        const pairs = await Promise.all(
          tokens.map(async (t) => {
            const bal = await fetchFlexersBalance(t.contract, actor);
            return [t.symbol, bal] as const;
          })
        );
        if (!cancelled) setFlexerBalanceBySymbol(Object.fromEntries(pairs));
      } catch {
        if (!cancelled) setFlexerBalanceBySymbol({});
      } finally {
        if (!cancelled) setFlexerBalanceLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [actor, loading, flexerEpoch, tokens]);

  const poolRows = poolsByContract[selectedToken.contract] ?? [];
  const poolsLoaded = poolRows.length > 0;

  const loadFlexPools = async () => {
    setLoadingPools(true);
    try {
      const rows = await fetchFlexPools(selectedToken.contract);
      if (!rows.length) {
        toast.error('No flex pools returned for this contract.');
        return;
      }
      setPoolsByContract((prev) => ({ ...prev, [selectedToken.contract]: rows }));
      const first = rows[0]!;
      setSelectedPoolRowId(String(first.id));
      setRewardSymbol(flexPoolRewardSymbol(first));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load flex pools.');
    } finally {
      setLoadingPools(false);
    }
  };

  useEffect(() => {
    const root = mainRef.current;
    if (!root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target.id) setActiveSection(visible.target.id);
      },
      { root, threshold: [0.45, 0.65, 0.85] }
    );

    navItems.forEach((item) => {
      const section = document.getElementById(item.id);
      if (section) observer.observe(section);
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!actor || loading) {
      setBridgeEasySnap(null);
      return;
    }
    let cancelled = false;
    setBridgeBalanceLoading(true);
    fetchBridgeEasySnapshot(actor)
      .then((snap) => {
        if (!cancelled) setBridgeEasySnap(snap);
      })
      .catch(() => {
        if (!cancelled) setBridgeEasySnap(null);
      })
      .finally(() => {
        if (!cancelled) setBridgeBalanceLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [actor, loading]);

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const submitAction = async (label: string, actions: FlexAction[]) => {
    if (!isLoggedIn || !actor) {
      toast.error('Connect a wallet first.');
      return;
    }

    setSubmitting(label);
    try {
      const result = await transact(actions);
      const txId = extractBroadcastTxId(result);
      const message = `${label} sent for ${selectedToken.symbol}.`;
      const baseOpts = { duration: BROADCAST_SUCCESS_TOAST_MS };

      if (txId) {
        const href = xprTransactionExplorerUrl(txId);
        toast.success(message, {
          ...baseOpts,
          description: (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-medium text-yellow-300 underline decoration-yellow-300/35 underline-offset-2 hover:text-yellow-200"
            >
              View transaction on explorer
              <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden />
            </a>
          ),
        });
      } else {
        toast.success(message, baseOpts);
      }
      setFlexerEpoch((n) => n + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `${label} failed.`);
    } finally {
      setSubmitting(null);
    }
  };

  const sendRewards = () =>
    submitAction('Send rewards', [
      {
        account: selectedToken.contract,
        name: selectedToken.sendAction,
        data: {},
      },
    ]);

  const changeRewardToken = () =>
    submitAction('Reward token update', [
      {
        account: selectedToken.contract,
        name: selectedToken.rewardAction,
        data: { owner: actor, token_symbol: rewardSymbol.trim().toUpperCase() },
      },
    ]);

  const optOutOfTax = () =>
    submitAction('Renounce rewards', [
      {
        account: selectedToken.contract,
        name: selectedToken.optOutAction,
        data: { account: actor, ban_status: true },
      },
    ]);

  const setInheritance = () => {
    if (!selectedToken.treeAction) return;
    submitAction('Set inheritance', [
      {
        account: selectedToken.contract,
        name: selectedToken.treeAction,
        data: {
          flexer: actor,
          tree: treeAccount.trim(),
          rate: Number(treeRate),
        },
      },
    ]);
  };

  const setInheritanceMemo = () => {
    if (!selectedToken.memoAction) return;
    submitAction('Set reward memo', [
      {
        account: selectedToken.contract,
        name: selectedToken.memoAction,
        data: { flexer: actor, custom_memo: customMemo },
      },
    ]);
  };

  const loadBridgeDepositAddress = async () => {
    if (loading) {
      toast.error('Wallet is still restoring—wait a moment and try again.');
      return;
    }
    if (!actor) {
      toast.error('No active account. Open the wallet menu in the header and select a connected wallet.');
      return;
    }

    setBridgeLoading('deposit');
    try {
      const existing = await fetchEasySolanaDepositAddress(actor);
      let address = existing.address;

      if (!address) {
        toast.info('No address yet—creating one.');
        address = await generateEasySolanaDepositAddress(actor);
        if (!address) {
          address = (await fetchEasySolanaDepositAddress(actor)).address;
        }
      }

      if (!address) {
        toast.error('Could not get an address yet. Try again in a moment.');
        return;
      }

      setBridgeDepositAddress(address);
      toast.success('Address ready.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBridgeLoading(null);
    }
  };

  const applyMaxEasyAmount = () => {
    if (bridgeBalanceLoading) {
      toast.error('Still loading your balance.');
      return;
    }
    if (!bridgeEasySnap || !Number.isFinite(bridgeEasySnap.balance)) {
      toast.error('Balance not available yet.');
      return;
    }
    setBridgeWithdrawAmount(bridgeEasySnap.balance.toFixed(6));
  };

  const withdrawEasyToSolana = async () => {
    if (loading) {
      toast.error('Wallet is still restoring—wait a moment and try again.');
      return;
    }
    if (!actor || !activeWallet) {
      toast.error('Connect a WebAuth wallet first.');
      return;
    }
    if (activeWallet.provider !== 'webauth') {
      toast.error('Switch to WebAuth in the header to sign this bridge.');
      return;
    }

    const destination = bridgeWithdrawAddress.trim();
    if (!destination) {
      toast.error('Add your Solana wallet address.');
      return;
    }

    let quantity: string;
    try {
      quantity = formatEasyQuantity(bridgeWithdrawAmount);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Invalid EASY amount.');
      return;
    }

    setBridgeLoading('withdraw');
    try {
      let snap = bridgeEasySnap;
      if (!snap) {
        try {
          snap = await fetchBridgeEasySnapshot(actor);
          setBridgeEasySnap(snap);
        } catch {
          // ignore; fall back below
        }
      }
      const signedTransaction = await signUnbroadcastWebAuthTransaction(activeWallet, [
        {
          account: EASY_MON3Y_CONTRACT,
          name: 'transfer',
          data: {
            from: actor,
            to: EASY_BRIDGE_CONTRACT,
            quantity,
            memo: `EASY-${EASY_BRIDGE_WALLET}@${destination}`,
          },
        },
      ]);

      await submitEasySolanaWithdrawal({
        user: actor,
        signedTransaction,
        withdrawQuote: BRIDGE_WITHDRAW_QUOTE_ID,
      });

      toast.success('Sent to the bridge.');
      setBridgeWithdrawAmount('');
      try {
        setBridgeEasySnap(await fetchBridgeEasySnapshot(actor));
      } catch {
        // ignore refresh errors
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Bridge did not complete.');
    } finally {
      setBridgeLoading(null);
    }
  };

  return (
    <div className="min-h-screen overflow-hidden bg-black text-yellow-50">
      <Header
        actor={actor}
        isLoggedIn={isLoggedIn}
        loading={loading}
        wallets={wallets}
        activeId={activeId}
        onAddWebAuth={addWebAuthWallet}
        onAddAnchor={addAnchorWallet}
        onSetActive={setActive}
        onRemoveWallet={removeWallet}
        onDisconnectAll={disconnectAll}
        navItems={navItems}
        activeSection={activeSection}
        onNavigate={scrollToSection}
      />

      <main
        ref={mainRef}
        className="h-screen overflow-y-auto scroll-smooth snap-y snap-mandatory bg-[radial-gradient(circle_at_top_left,rgba(250,204,21,0.2),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(234,179,8,0.12),transparent_32%),#020202]"
      >
        <SnapSection id="tools" eyebrow="Flex town" title="New earth finance for the EASY life.">
          <div className="w-full max-w-7xl space-y-5">
            <p className="max-w-xl text-lg text-yellow-100/70">
              Send rewards, change your reward token, or opt out of tax (warning, permanant). Pick a Flex token
              and take control.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              {featureCards.map((feature) => (
                <GlassCard key={feature.title}>
                  <TokenThumb src={feature.image} alt="" className="h-11 w-11 rounded-xl" />
                  <h3 className="mt-4 text-xl font-black text-yellow-100">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-yellow-100/60">{feature.body}</p>
                </GlassCard>
              ))}
            </div>
          </div>
        </SnapSection>

        <SnapSection id="flex-tools" eyebrow="On-chain" title="Flex Tools">
          <GlassCard className="w-full max-w-7xl p-4 sm:p-6">
              <div className="rounded-[2rem] border border-yellow-300/15 bg-black/60 p-2">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {tokens.map((token) => {
                    const selected = token.symbol === selectedSymbol;
                    return (
                      <button
                        key={token.symbol}
                        type="button"
                        onClick={() => {
                          setSelectedSymbol(token.symbol);
                          const cached = poolsByContract[token.contract];
                          if (cached?.length) {
                            setSelectedPoolRowId(String(cached[0].id));
                            setRewardSymbol(flexPoolRewardSymbol(cached[0]));
                          } else {
                            setSelectedPoolRowId(null);
                            setRewardSymbol(token.symbol);
                          }
                        }}
                        className={cn(
                          'flex w-full flex-col items-stretch rounded-[1.35rem] px-4 py-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow-300',
                          selected
                            ? 'bg-yellow-300 text-black shadow-[0_0_30px_rgba(250,204,21,0.28)]'
                            : 'bg-yellow-300/5 text-yellow-100 hover:bg-yellow-300/10'
                        )}
                      >
                        <TokenThumb
                          src={tokenLogoUrl(token, wonLogoUrl)}
                          alt={token.symbol}
                          className="h-10 w-10 shrink-0 rounded-lg"
                        />
                        <span className="mt-3 text-lg font-black uppercase tracking-[0.16em] sm:text-xl">
                          {token.symbol}
                        </span>
                        <span
                          className={cn(
                            'mt-2 block min-h-[1rem] text-center text-[10px] font-medium leading-tight tracking-tight',
                            selected ? 'text-black/55' : 'text-yellow-100/45'
                          )}
                        >
                          {!actor
                            ? `Acquire ${token.symbol}`
                            : flexerBalanceLoading
                              ? '…'
                              : flexerBalanceBySymbol[token.symbol]
                                ? `Balance ${flexerBalanceBySymbol[token.symbol]}`
                                : `Acquire ${token.symbol}`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-6 grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
                <div className="rounded-[2rem] border border-yellow-300/15 bg-yellow-300/[0.04] p-5">
                  <div className="flex flex-wrap items-start gap-4">
                    <TokenThumb
                      src={tokenLogoUrl(selectedToken, wonLogoUrl)}
                      alt={selectedToken.symbol}
                      className="h-16 w-16 rounded-2xl sm:h-20 sm:w-20"
                    />
                    <div className="min-w-0 flex-1">
                  <a
                    href={selectedToken.explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-[0.22em] text-yellow-300 underline-offset-4 hover:underline"
                  >
                    {selectedToken.contract}
                    <ExternalLink className="h-4 w-4" />
                  </a>
                  <h3 className="mt-3 text-3xl font-black text-yellow-50">{selectedToken.title}</h3>
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-yellow-100/65">{selectedToken.summary}</p>
                  <div className="mt-5 grid gap-3 text-sm">
                    <StatLine label="Tax" value={selectedToken.tax} />
                    <StatLine label="Reward min" value={selectedToken.minHold} />
                    <StatLink label="DEX analytics" href={selectedToken.analyticsUrl} value="Open Alcor" />
                  </div>
                  <div className="mt-8 flex justify-center">
                    <button
                      type="button"
                      onClick={sendRewards}
                      disabled={!isLoggedIn || submitting !== null}
                      className={cn(
                        'inline-flex max-w-lg items-center gap-6 rounded-2xl border border-yellow-300/25 bg-gradient-to-b from-yellow-300/[0.14] via-yellow-300/[0.06] to-black/85 px-8 py-6 shadow-[0_12px_40px_rgba(0,0,0,0.5)] backdrop-blur-md transition',
                        'hover:border-yellow-300/40 hover:from-yellow-300/[0.2] hover:shadow-[0_16px_48px_rgba(250,204,21,0.12)]',
                        'disabled:pointer-events-none disabled:opacity-40'
                      )}
                    >
                      <TokenThumb
                        src={tokenLogoUrl(selectedToken, wonLogoUrl)}
                        alt=""
                        className="h-20 w-20 shrink-0 rounded-2xl object-cover sm:h-24 sm:w-24"
                      />
                      <span className="flex min-w-0 flex-col text-center sm:text-left">
                        <span className="text-xl font-black uppercase tracking-[0.14em] text-yellow-50 sm:text-2xl">
                          {submitting === 'Send rewards' ? 'Sending…' : 'Send rewards'}
                        </span>
                        <span className="mt-2 flex items-center justify-center gap-2 text-sm text-yellow-100/70 sm:justify-start">
                          <Send className="h-4 w-4 shrink-0 text-yellow-300/90" />
                          <span className="font-mono text-xs uppercase tracking-wider text-yellow-100/55">
                            {selectedToken.sendAction}
                          </span>
                        </span>
                      </span>
                    </button>
                  </div>
                  <p className="mx-auto mt-3 max-w-md px-2 text-center text-[10px] leading-relaxed text-yellow-100/40">
                    {FLEX_REFLECTION_MIN_NOTE}
                  </p>
                </div>

                <div className="flex flex-col space-y-4">
                  <div className="rounded-[2rem] border border-yellow-300/15 bg-black/50 p-5">
                    <div className="flex items-center gap-3">
                      <TokenThumb
                        src={tokenLogoUrl(selectedToken, wonLogoUrl)}
                        alt=""
                        className="h-10 w-10 rounded-lg"
                      />
                      <div>
                        <h4 className="font-black text-yellow-50">Change Reward Token</h4>
                        <p className="text-xs text-yellow-100/55">{selectedToken.rewardAction}</p>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
                      <div className="space-y-2">
                        <Label htmlFor="reward-pool" className="text-yellow-100/80">
                          Reward pool
                        </Label>
                        {poolsLoaded ? (
                          <Select
                            value={selectedPoolRowId ?? undefined}
                            onValueChange={(id) => {
                              setSelectedPoolRowId(id);
                              const row = poolRows.find((r) => String(r.id) === id);
                              if (row) setRewardSymbol(flexPoolRewardSymbol(row));
                            }}
                          >
                            <SelectTrigger
                              id="reward-pool"
                              className="border-yellow-300/20 bg-black/70 text-yellow-50 focus:ring-yellow-300/30"
                            >
                              <SelectValue placeholder="Select pool" />
                            </SelectTrigger>
                            <SelectContent className="max-h-72 border-yellow-300/20 bg-zinc-950 text-yellow-50">
                              {poolRows.map((row) => (
                                <SelectItem
                                  key={row.id}
                                  value={String(row.id)}
                                  className="focus:bg-yellow-300/15 focus:text-yellow-50"
                                >
                                  {flexPoolLabel(row)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <p className="rounded-md border border-yellow-300/15 bg-black/50 px-3 py-2 text-sm text-yellow-100/55">
                            Tap &quot;Load available&quot; to fetch on-chain flex pools for {selectedToken.contract},
                            then choose a reward route.
                          </p>
                        )}
                      </div>
                      <Button
                        type="button"
                        onClick={() => {
                          if (poolsLoaded) void changeRewardToken();
                          else void loadFlexPools();
                        }}
                        disabled={
                          !isLoggedIn ||
                          submitting !== null ||
                          loadingPools ||
                          (poolsLoaded && !selectedPoolRowId)
                        }
                        className="self-end bg-yellow-300 text-black hover:bg-yellow-200"
                      >
                        {loadingPools
                          ? 'Loading...'
                          : poolsLoaded
                            ? 'Update'
                            : 'Load available'}
                      </Button>
                    </div>
                  </div>

                  {selectedToken.treeAction && (
                    <div className="rounded-[2rem] border border-yellow-300/15 bg-black/50 p-5">
                      <div className="flex items-center gap-3">
                        <TreePine className="h-5 w-5 shrink-0 text-yellow-300" />
                        <div>
                          <h4 className="font-black text-yellow-50">
                            {beneficiaryUi ? 'Beneficiary' : 'Inheritance'}
                          </h4>
                          <p className="text-xs text-yellow-100/55">{selectedToken.treeAction}</p>
                        </div>
                      </div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="tree-account" className="text-yellow-100/80">
                            Receiver account
                          </Label>
                          <Input
                            id="tree-account"
                            value={treeAccount}
                            onChange={(event) => setTreeAccount(event.target.value)}
                            placeholder="accountname"
                            className="border-yellow-300/20 bg-black/70 text-yellow-50"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="tree-rate" className="text-yellow-100/80">
                            Rate (10000 = 100%)
                          </Label>
                          <Input
                            id="tree-rate"
                            value={treeRate}
                            onChange={(event) => setTreeRate(event.target.value)}
                            inputMode="numeric"
                            className="border-yellow-300/20 bg-black/70 text-yellow-50"
                          />
                        </div>
                      </div>
                      <Button
                        type="button"
                        onClick={setInheritance}
                        disabled={!isLoggedIn || submitting !== null || !treeAccount.trim()}
                        className="mt-4 w-full bg-yellow-300 text-black hover:bg-yellow-200"
                      >
                        {submitting === 'Set inheritance'
                          ? 'Submitting…'
                          : beneficiaryUi
                            ? 'Submit beneficiary'
                            : 'Submit inheritance'}
                      </Button>
                    </div>
                  )}

                  {selectedToken.memoAction && (
                    <div className="rounded-[2rem] border border-yellow-300/15 bg-black/50 p-5">
                      <div className="flex items-center gap-3">
                        <Sprout className="h-5 w-5 shrink-0 text-yellow-300" />
                        <div>
                          <h4 className="font-black text-yellow-50">
                            {beneficiaryUi ? 'Custom benefit memo' : 'Reward memo'}
                          </h4>
                          <p className="text-xs leading-relaxed text-yellow-100/55">{FLEX_MEMO_INTRO}</p>
                        </div>
                      </div>
                      <div className="mt-4 space-y-2">
                        <Label htmlFor="tree-memo" className="text-yellow-100/80">
                          Memo template
                        </Label>
                        <p className="text-[11px] leading-relaxed text-yellow-100/40">
                          <span className="font-mono text-yellow-300/80">@@</span> becomes the recipient account.{' '}
                          <span className="font-mono text-yellow-300/80">$$</span> becomes the reward amount.{' '}
                          <span className="font-mono text-yellow-300/80">**</span> becomes the token symbol.
                        </p>
                        <Textarea
                          id="tree-memo"
                          value={customMemo}
                          onChange={(event) => setCustomMemo(event.target.value)}
                          className="min-h-20 border-yellow-300/20 bg-black/70 text-yellow-50"
                        />
                      </div>
                      <Button
                        type="button"
                        onClick={setInheritanceMemo}
                        disabled={!isLoggedIn || submitting !== null}
                        variant="outline"
                        className="mt-4 w-full border-yellow-300/30 bg-black/50 text-yellow-100 hover:bg-yellow-300 hover:text-black"
                      >
                        {submitting === 'Set reward memo'
                          ? 'Submitting…'
                          : beneficiaryUi
                            ? 'Submit custom benefit memo'
                            : 'Submit reward memo'}
                      </Button>
                    </div>
                  )}

                  <div className="mt-auto flex flex-wrap items-end justify-end gap-x-4 gap-y-1 border-t border-yellow-300/10 pt-4">
                    <button
                      type="button"
                      onClick={optOutOfTax}
                      disabled={!isLoggedIn || submitting !== null}
                      className="max-w-md text-right text-[11px] leading-snug text-yellow-100/35 underline-offset-2 transition hover:text-yellow-100/55 hover:underline disabled:pointer-events-none disabled:opacity-30"
                    >
                      {submitting === 'Renounce rewards'
                        ? 'Submitting renounce…'
                        : `Opt out of tax (${selectedToken.optOutAction}) — renounce rewards forever`}
                    </button>
                  </div>
                </div>
              </div>
            </GlassCard>
        </SnapSection>

        <SnapSection id="what" eyebrow="What is EASY" title="Buy once and stack tokens forever.">
          <div className="grid w-full max-w-7xl gap-8 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-6">
              <p className="text-xl leading-9 text-yellow-100/75">
                EASY is a Flex token on XPR Network: a reflexive money experiment where token movement fills a
                reward pool, then holders receive proportional rewards directly in their wallet.
              </p>
              <p className="text-lg leading-8 text-yellow-100/60">
                Hold EASY and the default experience is simple: more EASY arrives over time. Flex your reward
                token and the same reflection flow can route into another supported token instead.
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <Metric value="21M" label="Max EASY supply" />
                <Metric value="2%" label="Reflection tax" />
                <Metric value="100%" label="Launched into pools" />
              </div>
            </div>
            <GlassCard className="relative overflow-hidden p-8">
              <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-yellow-300/20 blur-3xl" />
              <div className="flex items-center gap-4">
                <TokenThumb src={TOKEN_LOGO.EASY} alt="EASY" className="h-14 w-14 rounded-2xl" />
                <Sparkles className="h-10 w-10 shrink-0 text-yellow-300" />
              </div>
              <h3 className="mt-8 text-4xl font-black text-yellow-50">Take it EASY 🍹.</h3>
              <p className="mt-4 text-yellow-100/65">
                The page is intentionally one move at a time: connect, choose the token, make the call, or jump
                into the live Alcor market.
              </p>
              <a
                href="https://flex.report"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-8 inline-flex rounded-full bg-yellow-300 px-6 py-3 text-sm font-black uppercase tracking-[0.18em] text-black hover:bg-yellow-200"
              >
                Flex Report
              </a>
            </GlassCard>
          </div>
        </SnapSection>

        <SnapSection id="money" eyebrow="The New Earth Finance" title="Financial energy, routed better.">
          <div className="grid w-full max-w-7xl gap-5 md:grid-cols-3">
            {[
              {
                icon: Globe2,
                title: 'Transparent Flow',
                body: 'Token taxes, reward pools, burns, and distribution calls are public contract activity.',
              },
              {
                icon: Sprout,
                title: 'Reflexive Rewards',
                body: 'Activity from the market can feed holders instead of leaking value out of the community.',
              },
              {
                icon: Network,
                title: 'Composable Economy',
                body: 'Flex tokens can route rewards into each other, wrapped assets, community budgets, and future pools.',
              },
            ].map((item) => (
              <GlassCard key={item.title} className="min-h-72 p-7">
                <item.icon className="h-9 w-9 text-yellow-300" />
                <h3 className="mt-8 text-3xl font-black text-yellow-50">{item.title}</h3>
                <p className="mt-4 leading-7 text-yellow-100/60">{item.body}</p>
              </GlassCard>
            ))}
          </div>
        </SnapSection>

        <SnapSection id="price" eyebrow="EASY / XUSDC" title="Trade on Alcor">
          <div className="flex w-full max-w-6xl flex-col gap-5">
            <p className="text-base leading-relaxed text-yellow-100/70">
              Live EASY/XUSDC spot order book on Alcor. Open token analytics for{' '}
              {tokens.map((token, i) => (
                <span key={token.symbol}>
                  {i > 0 ? ' ' : null}
                  <a
                    href={token.analyticsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold text-yellow-300 underline-offset-2 hover:text-yellow-100 hover:underline"
                  >
                    {token.symbol}
                  </a>
                </span>
              ))}
              .
            </p>
            <div className="overflow-hidden rounded-[2rem] border border-yellow-300/20 bg-black/70 shadow-[0_0_70px_rgba(234,179,8,0.12)]">
              <iframe
                title="EASY XUSDC spot market on Alcor"
                src={alcorEasySpotTrade}
                className="h-[68vh] w-full bg-black"
                loading="lazy"
              />
            </div>
          </div>
        </SnapSection>

        <SnapSection id="swap" eyebrow="Swap for EASY" title="Trade without leaving the page.">
          <div className="grid w-full max-w-7xl items-center gap-8 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="space-y-5">
              <TokenThumb src={TOKEN_LOGO.EASY} alt="EASY" className="h-14 w-14 rounded-2xl" />
              <p className="text-xl leading-9 text-yellow-100/75">
                The swap widget is preloaded from XUSDC to EASY. Change the input token in Alcor when your wallet
                holds something else.
              </p>
              <a
                href={alcorEasySwap}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex rounded-full bg-yellow-300 px-7 py-4 text-sm font-black uppercase tracking-[0.18em] text-black hover:bg-yellow-200"
              >
                Open Alcor Swap
              </a>
            </div>
            <div className="mx-auto w-full max-w-[500px] overflow-hidden rounded-[2rem] border border-yellow-300/20 bg-black/70">
              <iframe
                title="Swap EASY on Alcor"
                src={alcorEasySwapWidget}
                className="h-[650px] w-full bg-black"
                loading="lazy"
              />
            </div>
          </div>
        </SnapSection>

        <SnapSection id="works" eyebrow="How it works" title="Ranged liquidity below, reflections above.">
          <div className="grid w-full max-w-7xl gap-5 lg:grid-cols-4">
            {[
              ['1', 'Ranged pools', 'EASY launched into stablecoin pools across price ranges so buyers and bots can trade against deep rails.'],
              ['2', 'Market movement', 'Swaps and transfers create fee flow. Alcor pools collect swap fees while token contracts collect reflection tax.'],
              ['3', 'Reward pool', 'Reflection tax accumulates on-chain until someone runs the distribution action for the token.'],
              ['4', 'Wallet rewards', 'Eligible holders receive proportional rewards, optionally routed into their chosen Flex token.'],
            ].map(([step, title, body]) => (
              <GlassCard key={step} className="p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-yellow-300 text-xl font-black text-black">
                  {step}
                </div>
                <h3 className="mt-8 text-2xl font-black text-yellow-50">{title}</h3>
                <p className="mt-4 leading-7 text-yellow-100/60">{body}</p>
              </GlassCard>
            ))}
          </div>
        </SnapSection>

        <SnapSection id="tokens" eyebrow="Core Flex Tokens" title="EASY is the gateway. WON, GRAMS, and MEME add flavor.">
          <div className="grid w-full max-w-7xl gap-4 md:grid-cols-2 xl:grid-cols-4">
            {tokens.map((token) => (
              <GlassCard key={token.symbol} className="flex min-h-80 flex-col p-6">
                <div className="flex items-center justify-between">
                  <TokenThumb
                    src={tokenLogoUrl(token, wonLogoUrl)}
                    alt={token.symbol}
                    className="h-12 w-12 rounded-xl"
                  />
                  <a
                    href={token.explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-full border border-yellow-300/20 px-3 py-1 text-xs font-bold text-yellow-200 underline-offset-2 hover:bg-yellow-300 hover:text-black hover:underline"
                  >
                    {token.contract}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <h3 className="mt-8 text-4xl font-black text-yellow-50">{token.symbol}</h3>
                <p className="mt-3 text-lg font-bold text-yellow-200">{token.tagline}</p>
                <p className="mt-4 flex-1 leading-7 text-yellow-100/60">{token.summary}</p>
                <a
                  href={token.analyticsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-bold uppercase tracking-[0.14em] text-yellow-300 underline-offset-2 hover:text-yellow-100 hover:underline"
                >
                  Alcor analytics
                  <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-80" />
                </a>
                <a
                  href={`https://proton.alcor.exchange/swap?input=XUSDC-xtokens&output=${token.dexToken}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center justify-center rounded-full border border-yellow-300/25 px-5 py-3 text-sm font-black uppercase tracking-[0.16em] text-yellow-200 hover:bg-yellow-300 hover:text-black"
                >
                  Swap {token.symbol}
                </a>
              </GlassCard>
            ))}
          </div>
        </SnapSection>

        <SnapSection id="fringe" eyebrow="Beyond core" title="Fringe Flex Tokens">
          <div className="w-full max-w-7xl space-y-6">
            <p className="max-w-3xl text-lg leading-8 text-yellow-100/70">
              Fringe flex tokens created by volunteers that don't even flex
            </p>
            <div className="grid gap-4 md:grid-cols-2">
            <GlassCard className="flex min-h-72 flex-col p-6">
              <div className="flex items-start justify-between gap-4">
                <TokenThumb src={TOKEN_LOGO.HARD} alt="HARD" className="h-14 w-14 rounded-xl" />
                <a
                  href="https://explorer.xprnetwork.org/account/simpletoken?loadContract=true&tab=actions&account=simpletoken&scope=simpletoken&limit=100"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex shrink-0 items-center gap-1 rounded-full border border-yellow-300/20 px-3 py-1 text-xs font-bold text-yellow-200 underline-offset-2 hover:bg-yellow-300 hover:text-black hover:underline"
                >
                  simpletoken
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <h3 className="mt-6 text-4xl font-black text-yellow-50">HARD</h3>
              <p className="mt-2 text-sm font-bold uppercase tracking-[0.14em] text-yellow-200/90">HARD@simpletoken</p>
              <p className="mt-4 flex-1 leading-7 text-yellow-100/65">
                Our community-led SimpleDex parody of EASY, with no flex mechanics.
              </p>
              <a
                href="https://alcor.exchange/v/xpr/analytics/tokens/hard-simpletoken"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-bold uppercase tracking-[0.14em] text-yellow-300 underline-offset-2 hover:text-yellow-100 hover:underline"
              >
                Alcor analytics
                <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-80" />
              </a>
              <a
                href="https://proton.alcor.exchange/swap?input=XUSDC-xtokens&output=HARD-simpletoken"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center justify-center rounded-full border border-yellow-300/25 px-5 py-3 text-sm font-black uppercase tracking-[0.16em] text-yellow-200 hover:bg-yellow-300 hover:text-black"
              >
                Swap HARD
              </a>
            </GlassCard>

            <GlassCard className="flex min-h-72 flex-col p-6">
              <div className="flex items-start justify-between gap-4">
                <TokenThumb src={TOKEN_LOGO.INDEX} alt="INDEX" className="h-14 w-14 rounded-xl" />
                <a
                  href="https://explorer.xprnetwork.org/account/xfund?loadContract=true&tab=actions&account=xfund&scope=xfund&limit=100"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex shrink-0 items-center gap-1 rounded-full border border-yellow-300/20 px-3 py-1 text-xs font-bold text-yellow-200 underline-offset-2 hover:bg-yellow-300 hover:text-black hover:underline"
                >
                  xfund
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <h3 className="mt-6 text-4xl font-black text-yellow-50">INDEX</h3>
              <p className="mt-2 text-sm font-bold uppercase tracking-[0.14em] text-yellow-200/90">INDEX@xfund</p>
              <p className="mt-4 flex-1 leading-7 text-yellow-100/65">
                INDEX uses smart-contract buy orders to attempt a 1000:1 soft peg to XPR (currently failing). No flex
                mechanics. INDEX uses pool fees earned to buy back on spot markets, aiming to repeg to 1000:1 XPR.
              </p>
              <a
                href="https://alcor.exchange/v/xpr/analytics/tokens/index-xfund"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-bold uppercase tracking-[0.14em] text-yellow-300 underline-offset-2 hover:text-yellow-100 hover:underline"
              >
                Alcor analytics
                <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-80" />
              </a>
              <a
                href="https://proton.alcor.exchange/swap?input=XUSDC-xtokens&output=INDEX-xfund"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center justify-center rounded-full border border-yellow-300/25 px-5 py-3 text-sm font-black uppercase tracking-[0.16em] text-yellow-200 hover:bg-yellow-300 hover:text-black"
              >
                Swap INDEX
              </a>
            </GlassCard>
            </div>
          </div>
        </SnapSection>

        <SnapSection id="solana" eyebrow="EASY on Solana" title="Same EASY supply, different chain behavior.">
          <div className="grid w-full max-w-7xl gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="space-y-5">
              <TokenThumb src={TOKEN_LOGO.EASY} alt="EASY" className="h-16 w-16 rounded-2xl" />
              <p className="text-xl leading-9 text-yellow-100/75">
                EASY on Solana uses this mint address:{' '}
                <span className="break-all font-mono text-yellow-300">{EASY_SOLANA_MINT}</span>.
              </p>
              <GlassCard className="space-y-4 p-6">
                <h3 className="text-2xl font-black text-yellow-50">Important reflection note</h3>
                <p className="leading-7 text-yellow-100/65">
                  Flex reflections happen on XPR Network only. EASY held on Solana does not receive reflections,
                  does not generate reflection tax, and cannot use Flex reward routing until it is bridged back to
                  XPR.
                </p>
                <p className="leading-7 text-yellow-100/60">
                  Use the bridge below when you want to move EASY between XPR and Solana.
                </p>
              </GlassCard>
              <a
                href={jupiterEasySwap}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-yellow-300 px-7 py-4 text-sm font-black uppercase tracking-[0.18em] text-black hover:bg-yellow-200"
              >
                Open Jupiter
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
            <div className="overflow-hidden rounded-[2rem] border border-yellow-300/20 bg-black/70 shadow-[0_0_70px_rgba(234,179,8,0.12)]">
              <JupiterEasyPlugin className="bg-black" />
            </div>
          </div>
        </SnapSection>

        <SnapSection id="bridge" eyebrow="Bridge" title="EASY between XPR and Solana.">
          <GlassCard className="w-full max-w-7xl p-4 sm:p-6">
            <div className="grid gap-5 lg:grid-cols-2">
              <div className="rounded-[2rem] border border-yellow-300/15 bg-black/55 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-2xl font-black text-yellow-50">From EASY on Solana</h3>
                    <p className="mt-2 leading-7 text-yellow-100/65">
                      You send EASY on Solana into your personal receive address. It arrives as EASY on your XPR
                      account.
                    </p>
                  </div>
                  <TokenThumb src={TOKEN_LOGO.EASY} alt="" className="h-12 w-12 rounded-xl" />
                </div>

                <div className="mt-5 rounded-2xl border border-yellow-300/15 bg-yellow-300/[0.04] p-4">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-yellow-300">Receive address</p>
                  <p className="mt-3 break-all font-mono text-sm leading-6 text-yellow-100/80">
                    {bridgeDepositAddress ??
                      (loading
                        ? 'One moment…'
                        : actor
                          ? 'Tap the button to show your address.'
                          : 'Connect a wallet in the header first.')}
                  </p>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
                  <Button
                    type="button"
                    onClick={loadBridgeDepositAddress}
                    disabled={loading || !actor || bridgeLoading !== null}
                    className="bg-yellow-300 text-black hover:bg-yellow-200"
                  >
                    {bridgeLoading === 'deposit' ? 'Loading...' : 'Show my address'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!bridgeDepositAddress}
                    onClick={() => {
                      if (!bridgeDepositAddress) return;
                      void navigator.clipboard?.writeText(bridgeDepositAddress);
                      toast.success('Copied.');
                    }}
                    className="border-yellow-300/30 bg-black/50 text-yellow-100 hover:bg-yellow-300 hover:text-black"
                  >
                    Copy
                  </Button>
                </div>
              </div>

              <div className="rounded-[2rem] border border-yellow-300/15 bg-black/55 p-5">
                <h3 className="text-2xl font-black text-yellow-50">To EASY on Solana</h3>
                <p className="mt-2 leading-7 text-yellow-100/65">
                  You send EASY from XPR. It lands as EASY on Solana in the wallet you choose below.
                </p>

                <div className="mt-5 grid gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="bridge-solana-address" className="text-yellow-100/80">
                      Your Solana wallet
                    </Label>
                    <Input
                      id="bridge-solana-address"
                      value={bridgeWithdrawAddress}
                      onChange={(event) => setBridgeWithdrawAddress(event.target.value)}
                      placeholder="Solana address"
                      className="border-yellow-300/20 bg-black/70 font-mono text-yellow-50"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <Label htmlFor="bridge-easy-amount" className="text-yellow-100/80">
                        How much EASY
                      </Label>
                      <span className="text-xs text-yellow-100/55">
                        {bridgeBalanceLoading || loading ? (
                          'Balance…'
                        ) : actor && bridgeEasySnap != null ? (
                          <>
                            Your EASY on XPR:{' '}
                            <span className="font-mono font-semibold text-yellow-200/90">
                              {bridgeEasySnap.balance.toFixed(6)} EASY
                            </span>
                          </>
                        ) : actor ? (
                          'Balance unavailable'
                        ) : (
                          '—'
                        )}
                      </span>
                    </div>
                    <div className="relative">
                      <Input
                        id="bridge-easy-amount"
                        value={bridgeWithdrawAmount}
                        onChange={(event) => setBridgeWithdrawAmount(event.target.value)}
                        placeholder="0.0000"
                        inputMode="decimal"
                        className="border-yellow-300/20 bg-black/70 pr-16 text-yellow-50"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={applyMaxEasyAmount}
                        disabled={
                          loading ||
                          bridgeBalanceLoading ||
                          !bridgeEasySnap ||
                          !Number.isFinite(bridgeEasySnap.balance)
                        }
                        className="absolute right-1 top-1/2 h-8 -translate-y-1/2 px-2 text-xs font-bold uppercase tracking-wide text-yellow-300 hover:bg-yellow-300/15 hover:text-yellow-100"
                      >
                        Max
                      </Button>
                    </div>
                    <p className="text-xs text-yellow-100/50">
                      Bridge fee when leaving XPR for Solana: {BRIDGE_FEE_XPR_TO_SOLANA_EASY} EASY.
                    </p>
                  </div>

                  <Button
                    type="button"
                    onClick={withdrawEasyToSolana}
                    disabled={
                      loading ||
                      !actor ||
                      !bridgeWithdrawAddress.trim() ||
                      !bridgeWithdrawAmount.trim() ||
                      bridgeLoading !== null
                    }
                    className="w-full bg-yellow-300 text-black hover:bg-yellow-200"
                  >
                    {bridgeLoading === 'withdraw' ? 'Sending…' : 'Bridge to Solana'}
                  </Button>
                </div>
              </div>
            </div>
          </GlassCard>
        </SnapSection>

        <footer className="snap-start border-t border-yellow-300/15 bg-black/95 px-4 py-14 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl space-y-5 text-center text-xs leading-relaxed text-yellow-100/50 sm:text-sm">
            <p>
              This site and any wallet actions you take through it are provided for general information only. Nothing
              here is an offer or solicitation to buy or sell any token, security, or financial instrument, and nothing
              constitutes legal, tax, or investment advice. Digital assets are experimental, volatile, and may become
              worthless. Past or described mechanics (including pegs, buybacks, or rewards) are not guarantees of future
              behavior. Smart contracts and interfaces can contain bugs or change without notice.
            </p>
            <p>
              By using this site you agree that you alone decide whether to interact with on-chain contracts, that you
              understand the risks of total loss, and that the authors, contributors, and operators of this site disclaim
              all warranties and all liability—including for indirect or consequential damages—to the fullest extent
              permitted by law. You use this site and any linked services at your own risk.
            </p>
            <p className="text-yellow-100/40">
              Built on XPR Network. Token mechanics can change; verify contract actions before high-value calls.
            </p>
          </div>
        </footer>
      </main>
    </div>
  );
};

function TokenThumb({ src, alt, className }: { src: string; alt: string; className?: string }) {
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={cn('shrink-0 object-cover', className)}
    />
  );
}

function SnapSection({
  id,
  eyebrow,
  title,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="relative flex min-h-screen snap-start flex-col items-center justify-center overflow-hidden px-4 pb-12 pt-28 sm:px-6 lg:px-8"
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(250,204,21,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(250,204,21,0.04)_1px,transparent_1px)] bg-[size:72px_72px]" />
      <div className="relative z-10 mb-8 w-full max-w-7xl">
        <p className="text-sm font-black uppercase tracking-[0.34em] text-yellow-300">{eyebrow}</p>
        <h2 className="mt-4 max-w-5xl text-4xl font-black tracking-tight text-yellow-50 sm:text-6xl lg:text-7xl">
          {title}
        </h2>
      </div>
      <div className="relative z-10 flex w-full justify-center">{children}</div>
    </section>
  );
}

function GlassCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-[2rem] border border-yellow-300/15 bg-yellow-200/[0.035] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_30px_90px_rgba(0,0,0,0.35)] backdrop-blur-xl',
        className
      )}
    >
      {children}
    </div>
  );
}

function StatLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-yellow-300/10 bg-black/40 px-4 py-3">
      <span className="text-yellow-100/50">{label}</span>
      <span className="font-bold text-yellow-100">{value}</span>
    </div>
  );
}

function StatLink({ label, value, href }: { label: string; value: string; href: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-yellow-300/10 bg-black/40 px-4 py-3">
      <span className="text-yellow-100/50">{label}</span>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 font-bold text-yellow-200 underline-offset-2 hover:text-yellow-50 hover:underline"
      >
        {value}
        <ExternalLink className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-[1.5rem] border border-yellow-300/15 bg-yellow-300/[0.05] p-5">
      <div className="text-4xl font-black text-yellow-300">{value}</div>
      <div className="mt-2 text-sm uppercase tracking-[0.18em] text-yellow-100/55">{label}</div>
    </div>
  );
}

export default Index;
