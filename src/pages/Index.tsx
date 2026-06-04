/**
 * Index page — EASY one-page snap-scroll landing and token tools.
 */
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EasyLifeBranchTree } from '@/components/EasyLifeBranchTree';
import { EasyLifeShareBar } from '@/components/EasyLifeShareBar';
import { InviteNationSelect } from '@/components/InviteNationSelect';
import {
  Ask4InviteDialog,
  type Ask4InviteSubmitPayload,
} from '@/components/Ask4InviteDialog';
import {
  InviteQueueRequestDialog,
  truncateInviteMessage,
  type InviteQueueRequestDetail,
} from '@/components/InviteQueueRequestDialog';
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
import { ASK4INVITE_MESSAGE_MAX, formatAsk4InviteCharCount } from '@/constants/ask4inviteUi';
import { pickRandomWonVariant, TOKEN_LOGO } from '@/constants/tokenAssets';
import { useProton } from '@/hooks/useProton';
import { cn } from '@/lib/utils';
import {
  fetchFlexPools,
  flexPoolLabel,
  flexPoolRewardSymbol,
  type FlexPoolRow,
} from '@/services/flexPools';
import {
  fetchReflectionPoolBalance,
  formatFlexAssetPretty,
} from '@/services/flexFlexerBalance';
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
import {
  EASY_INVITE_CONTRACT,
  EASY_INVITE_MIN_AMOUNT,
  EASY_INVITE_TOKEN_CONTRACT,
  TETRAHEDRAL_LISTED_TIER_COUNT,
  TETRAHEDRAL_MAX_LEVEL,
  TETRAHEDRAL_TABLE_ROW_COUNT,
  TETRAHEDRAL_THRESHOLDS,
  fetchEasyInviteAccountStatus,
  fetchEasyInviteAdopter,
  EASY_REWELCOME_MEMO,
  fetchEasyInviteProgramStatus,
  fetchEasyInviteRequests,
  fetchInviteRequestMessages,
  welcomeBackMinimumEasy,
  type EasyInviteAccountStatus,
  type EasyInviteProgramStatus,
  type EasyInviteRequest,
} from '@/services/easyInvite';
import { postInviteRequestMessage } from '@/services/inviteMessageSheet';
import { fetchBridgeEasySnapshot, type BridgeEasySnapshot } from '@/services/easyBalance';
import { signUnbroadcastWebAuthTransaction, isStorexWebAuthSigner } from '@/services/walletSessions';
import {
  ChevronDown,
  ExternalLink,
  Globe2,
  Network,
  Send,
  Sparkles,
  Sprout,
  TreePine,
  Users,
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
  summary: ReactNode;
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
  /** Shown after `Min.` for reflection-route floor copy (per token). */
  reflectionRouteMin: string;
  /** Public URL under `/assets/tokens/`. Omit for WON — a random variant is picked once per page load. */
  logoPath?: string;
};

const navItems = [
  { id: 'tools', label: 'Flex town' },
  { id: 'flex-tools', label: 'Flex Tools' },
  { id: 'what', label: 'What Is EASY' },
  { id: 'money', label: 'Finance' },
  { id: 'price', label: 'Trade', hideBelowMd: true },
  { id: 'swap', label: 'Swap' },
  { id: 'works', label: 'How It Works' },
  { id: 'tokens', label: 'Core Flex' },
  { id: 'fringe', label: 'Fringe' },
  { id: 'solana', label: 'Solana' },
  { id: 'bridge', label: 'Bridge' },
  { id: 'easy-life', label: 'Welcome' },
  { id: 'unlock', label: 'Unlock' },
];

/** Snap panels that share one nav tab (e.g. Welcome program + branch tree). */
const NAV_SECTION_ALIASES: Record<string, string> = {
  'easy-life-status': 'easy-life',
  'easy-life-branch': 'easy-life',
};

const tokens: TokenConfig[] = [
  {
    symbol: 'EASY',
    contract: 'mon3y',
    title: 'Take it EASY 🍹',
    tagline: 'The blue-chip flex—Pure-liquid reflections on Alcor.',
    summary:
      "The blue-chip flex, EASY delivers reflections and is pure liquid for stables. Gresham's law unfolding, we do more volume on Alcor than USDC.",
    tax: '2% reflection',
    minHold: '100+ EASY',
    dexToken: 'EASY-mon3y',
    analyticsUrl: 'https://alcor.exchange/v/xpr/analytics/tokens/easy-mon3y',
    explorerUrl: 'https://explorer.xprnetwork.org/account/mon3y?loadContract=true&tab=actions&account=mon3y&scope=mon3y&limit=100',
    logoPath: TOKEN_LOGO.EASY,
    sendAction: 'distribute',
    rewardAction: 'setflextoken',
    optOutAction: 'noflexzone',
    reflectionRouteMin: '1,000 EASY',
  },
  {
    symbol: 'WON',
    contract: 'w3won',
    title: 'We WON ⓦ',
    tagline: 'Rotating default reflection for New Earth—sponsor projects, gift tokens.',
    summary:
      'WON uses a changing default reflection token to benefit New Earth by giving you tokens from new projects. Currently reflects EASY until we have a project to sponsor.',
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
    reflectionRouteMin: '8 WON',
  },
  {
    symbol: 'GRAMS',
    contract: 'gold.mon3y',
    title: 'Golden GRAMS',
    tagline: 'Generational gold—inheritance to any account, reflects grams.',
    summary:
      'Generational wealth stored in gold. Grandchildren-approved, with inheritance functionality for any account. Pure liquid for Paxos Gold, GRAMS reflects grams by default.',
    tax: '1.1% reflection + 0.11% team',
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
    reflectionRouteMin: '0.1 GRAMS',
  },
  {
    symbol: 'MEME',
    contract: 'm3m3',
    title: 'GM Degens 🍦',
    tagline: 'Fun-first Flex for Alcor farms—unbacked, slow-burn meme ruler.',
    summary: (
      <>
        MEME is totally for fun and used to reward{' '}
        <a
          href="https://alcor.exchange/v/xpr/farm"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-yellow-200/90 underline underline-offset-2 hover:text-yellow-50"
        >
          farms
        </a>{' '}
        {` on XPR. Not pure liquid, not backed, good ol' fashioned slow-burn meme token to rule all meme tokens.`}
      </>
    ),
    tax: '1% reflection + 1% burn',
    minHold: '1M+ MEME',
    dexToken: 'MEME-m3m3',
    analyticsUrl: 'https://alcor.exchange/v/xpr/analytics/tokens/meme-m3m3',
    explorerUrl: 'https://explorer.xprnetwork.org/account/m3m3?loadContract=true&tab=actions&account=m3m3&scope=m3m3&limit=100',
    logoPath: TOKEN_LOGO.MEME,
    sendAction: 'distribute',
    rewardAction: 'setflextoken',
    optOutAction: 'noflexzone',
    reflectionRouteMin: '10M MEME',
  },
];

const WON_GRAMS_BENEFICIARY_UI = new Set(['WON', 'GRAMS']);

const DEFAULT_FLEX_BENEFIT_MEMO: Partial<Record<string, string>> = {
  WON: "Blessings @@. I've passed some of my rewards to you $$ ** I get from WON",
  GRAMS: "Blessings @@. I've passed some of my rewards to you $$ ** I get from GRAMS",
};

const FLEX_MEMO_INTRO =
  'Create a custom memo to activate other contracts, or just say hello.';

const featureCards = [
  {
    image: TOKEN_LOGO.EASY,
    title: 'Send It',
    body: 'Splash mon3y in the reflection pool on kin, your click sends pending rewards to all holders.',
    sectionId: 'flex-tools',
  },
  {
    image: TOKEN_LOGO.GRAMS,
    title: 'Flex your Reward Token',
    body: 'Choose your rewards: let EASY compound or stack OG blue chips like XBTC, XXRP, METAL. Holders of WON and GRAMS can pass on % of rewards to any account, with a custom memo feature.',
    sectionId: 'flex-tools',
  },
  {
    image: TOKEN_LOGO.EASY,
    title: 'Welcome Program',
    body: 'Welcoming someone costs 200 EASY: 100 to their wallet and 100 to the collective vault. Vault yield splits among participants, with multipliers as your network grows.',
    sectionId: 'easy-life',
  },
];

const firstFoldJumpLinks = [
  { id: 'flex-tools', emoji: '💸', label: 'Send it' },
  { id: 'bridge', emoji: '🌉', label: 'Solana XPR Bridge' },
  { id: 'easy-life', emoji: '🤝', label: 'Welcome Friend' },
  { id: 'ask4invite', emoji: '🙌', label: 'ask4invite', opensAsk4Invite: true as const },
  { id: 'community-chat', emoji: '💬', label: 'Community Chat', href: 'https://t.me/flextokens' },
] as const;

/** Alcor XPR web UI: `https://alcor.exchange/v/xpr/...` (swap, swap-widget, terminal, farm). */
const alcorEasyTerminal = 'https://alcor.exchange/v/xpr/terminal/easy-mon3y';
const alcorEasySwap = 'https://alcor.exchange/v/xpr/swap?input=XUSDC-xtokens&output=EASY-mon3y';
const alcorEasySpotTrade = 'https://alcor.exchange/v/xpr/trade/easy-mon3y_xusdc-xtokens';
const alcorEasySwapWidget = 'https://alcor.exchange/v/xpr/swap-widget?input=XUSDC-xtokens&output=EASY-mon3y';
const fractalWhitePaperUrl = 'https://fractally.com/uploads/Fractally%20White%20Paper%201.0.pdf';
const contributorsClubCalendarUrl =
  'https://calendar.google.com/calendar/u/0/r/eventedit?text=Contributors+Club&dates=20260127T170000Z/20260127T180000Z&details=Share+your+contributions+to+EASY+and+WON+in+3-5+minutes+and+rank+others+to+distribute+shares.+www.flex.town.%0A%0AAlways+5PM+UTC%0AReal+Link:+https://meet.google.com/dqq-yian-hch&location=https://meet.google.com/dqq-yian-hch&recur=RRULE:FREQ%3DWEEKLY;INTERVAL%3D2;BYDAY%3DTU';

const inlineLinkClass =
  'font-bold text-yellow-300 underline-offset-2 hover:text-yellow-100 hover:underline';

const codeInlineClass = 'rounded bg-yellow-300/10 px-1 py-0.5 text-[0.9em] text-yellow-200';

const howItWorksSteps: { step: string; title: string; body: ReactNode }[] = [
  {
    step: '1',
    title: 'Ranged liquidity day 0',
    body: (
      <>
        Pump and dump market mechanics come from pricing the initial market cap too low, dangerous due to outstanding supply
        valued multiples higher than when it was added to the pool. We ranged EASY starting at a 210K market cap, one shiny penny,
        maxing out at a 2.1T market cap, 100K. This magic range allows initial buys to be a gift but not a steal,
        keeping enough allocated EASY for a reliable mon3y supply to BTC-level prices. Pure liquid tokens: EASY (for
        USDish) WON (for EASY), and GRAMS (for gold)
      </>
    ),
  },
  {
    step: '2',
    title: 'Abundance in Arbitrage',
    body: (
      <>
        Price differences between Alcor and Metal DEX are always eaten by bots when EASY is pooled with the assets. Bots
        trigger trades and pay transfer fees that we pass to holders, themselves also profiting, but often much less
        than we do.
        <span className="mt-3 block">
          Reliable volume from the outside crypto world enables liquidity provision as a healthy side hustle with wider
          market movements mirrored to XPR Network via <code className={codeInlineClass}>xtokens</code> like XBTC,
          XXRP, XETH, XSOL.
        </span>
      </>
    ),
  },
  {
    step: '3',
    title: 'Reflection pool',
    body: (
      <>
        Watch the tax accumulate on-chain until someone musters a click to send it. Technically called Reflection Pool
        on the contract, it&apos;s where tokens collect before being splashed to wallets. There&apos;s also a burn
        pool on all tokens and a project pool for WON and GRAMS, but only MEME uses the burn pool.
      </>
    ),
  },
  {
    step: '4',
    title: 'Fractal Volunteer Organization',
    body: (
      <>
        We{' '}
        <a
          href={contributorsClubCalendarUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={inlineLinkClass}
        >
          meet
        </a>{' '}
        every 2 weeks to present + celebrate what we&apos;ve done for Flex tokens through a{' '}
        <a href={fractalWhitePaperUrl} target="_blank" rel="noopener noreferrer" className={inlineLinkClass}>
          fractal
        </a>{' '}
        process, check flex charts, and gossip the latest on EASY, XPR, crypto. EASY is served to the top 3 consensus-chosen
        winners.{' '}
        <a
          href={contributorsClubCalendarUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={inlineLinkClass}
        >
          Join us
        </a>
        .
      </>
    ),
  },
];

const solanaWrappedSolMint = 'So11111111111111111111111111111111111111112';
const jupiterEasySwap = `https://jup.ag/swap?sell=${solanaWrappedSolMint}&buy=${EASY_SOLANA_MINT}`;

/** Storex withdraw API expects a quote id; fixed fee path uses this literal. */
const BRIDGE_WITHDRAW_QUOTE_ID = 'FIXED';
/** Shown in UI; XPR → Solana bridge fee (EASY). */
const BRIDGE_FEE_XPR_TO_SOLANA_EASY = 25;
const EASY_INVITE_ACCOUNT_RE = /^[a-z1-5.]{1,12}$/;
const EASY_INVITE_DEFAULT_MEMO = 'Welcome to the EASY Life 🍹';

function tokenLogoUrl(token: TokenConfig, wonRandom: string): string {
  if (token.symbol === 'WON') return wonRandom;
  return token.logoPath ?? TOKEN_LOGO.EASY;
}

const FLEX_TOWN_STORY_PARAGRAPHS = [
  'Flex tokens charge a transfer fee to distribute back to holders as flexible rewards they choose, EASY 2%, GRAMS 1.1% reflection + 0.11% team, WON 3% and MEME 2%.',
  'Choose your Flex token, set your rewards, or let it compound.',
  'MEME offered burns and reflections, and EASY learned that we needed real tokens backing to maintain price.',
  'EASY became the star as the first pure liquid Flex token, surpassing all other community alts on XPR by swap volume.',
  'WON expanded the tech to custom memos and beneficiaries pure liquid, and brought the focus to building the New Earth in real life tokenizing one project at a time.',
  'GRAMS kept the tech improvements with a chain-wide gilding quest, pure liquid gold reflecting Paxos gold.',
  'Flex Tokens seek the most efficient path for finance to fuel the New Earth.',
] as const;

function FlexTownStoryRotator() {
  const [index, setIndex] = useState(0);
  const [opaque, setOpaque] = useState(true);

  useEffect(() => {
    const visibleMs = 6400;
    const fadeMs = 500;
    let alive = true;

    const loop = async () => {
      while (alive) {
        await new Promise<void>((r) => {
          window.setTimeout(r, visibleMs);
        });
        if (!alive) break;
        setOpaque(false);
        await new Promise<void>((r) => {
          window.setTimeout(r, fadeMs);
        });
        if (!alive) break;
        setIndex((i) => (i + 1) % FLEX_TOWN_STORY_PARAGRAPHS.length);
        setOpaque(true);
      }
    };

    void loop();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="min-h-[9rem] max-w-xl sm:min-h-[8rem]">
      <p
        className={cn(
          'text-lg leading-relaxed text-yellow-100/70 transition-opacity duration-500 ease-in-out',
          opaque ? 'opacity-100' : 'opacity-0'
        )}
      >
        {FLEX_TOWN_STORY_PARAGRAPHS[index]}
      </p>
    </div>
  );
}

const EASY_WHAT_STORY_PARAGRAPHS = [
  'EASY is a New Earth mon3y experiment, a token on XPR Network that sends you more EASY over time.',
  "We're testing Gresham's law against USD where holding individual stablecoins becomes bad money compared to the more-liquid EASY, driving industry-trusted stablecoins into 5 xtokens pools for USDC, USDT, XMD, Paxos Dollar, PYUSD, each paired with 4.20M EASY at day 1.",
  'The price range was set from One Penny to 100k USD(c) for a logical and lucrative absorption of stables.',
  'This makes EASY a better token to LP with, and because it holds liquid stables, it increases volume in the entire ecosystem.',
  'Our ecosystem of bi-weekly meetings democratically rewards contributors is funded by a protocol fee each reflection paid from the rewards pool, not individuals.',
  'The price has historically increased, with never 2 consecutive negative months or 4 consecutive negative weeks, a strong historic growth partially from constant buybacks from LP pool fees.',
  "We serve a unique purpose, not to make money for people, but to fix mon3y for people. We hope you enjoy EASY and feel proud to take part in a new type of mon3y, one where the people are rewarded from the entire financial system's activity.",
  'Because the supply is the same as BTC, this makes EASY a merger of the spirit of Bitcoin and the stability of stables.',
  'Mining becomes market making, as when anyone acquires EASY, it came from funds that are now a part of the 5 stablecoin pools.',
  'EASY is easy: more EASY arrives over time. Flex your reward token, or do nothing, just take it EASY 🍹',
] as const;

function EasyWhatStoryRotator() {
  const [index, setIndex] = useState(0);
  const [opaque, setOpaque] = useState(true);

  useEffect(() => {
    const visibleMs = 6400;
    const fadeMs = 500;
    let alive = true;

    const loop = async () => {
      while (alive) {
        await new Promise<void>((r) => {
          window.setTimeout(r, visibleMs);
        });
        if (!alive) break;
        setOpaque(false);
        await new Promise<void>((r) => {
          window.setTimeout(r, fadeMs);
        });
        if (!alive) break;
        setIndex((i) => (i + 1) % EASY_WHAT_STORY_PARAGRAPHS.length);
        setOpaque(true);
      }
    };

    void loop();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="min-h-[12rem] max-w-xl sm:min-h-[10rem]">
      <p
        className={cn(
          'text-lg leading-relaxed text-yellow-100/70 transition-opacity duration-500 ease-in-out sm:text-xl sm:leading-8',
          opaque ? 'opacity-100' : 'opacity-0'
        )}
      >
        {EASY_WHAT_STORY_PARAGRAPHS[index]}
      </p>
    </div>
  );
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
    addXprWallet,
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
  const [easyLifeExpanded, setEasyLifeExpanded] = useState(false);
  const [inviteAccount, setInviteAccount] = useState('');
  const [inviteAmount, setInviteAmount] = useState(String(EASY_INVITE_MIN_AMOUNT));
  const [inviteMemo, setInviteMemo] = useState(EASY_INVITE_DEFAULT_MEMO);
  const [inviteAccountStatus, setInviteAccountStatus] = useState<EasyInviteAccountStatus | null>(null);
  const [inviteAccountChecking, setInviteAccountChecking] = useState(false);
  const [inviteProgramStatus, setInviteProgramStatus] = useState<EasyInviteProgramStatus | null>(null);
  const [inviteProgramLoading, setInviteProgramLoading] = useState(false);
  const [askWelcomeAccount, setAskWelcomeAccount] = useState('');
  const [askWelcomeMessage, setAskWelcomeMessage] = useState('');
  const [askWelcomeNation, setAskWelcomeNation] = useState('');
  const [ask4InviteOpen, setAsk4InviteOpen] = useState(false);
  const [inviteRequests, setInviteRequests] = useState<EasyInviteRequest[]>([]);
  const [inviteRequestsLoading, setInviteRequestsLoading] = useState(false);
  const [inviteRequestMessages, setInviteRequestMessages] = useState<Record<string, string>>({});
  const [expandedInviteRequest, setExpandedInviteRequest] = useState<InviteQueueRequestDetail | null>(null);
  const [reflectionPoolBySymbol, setReflectionPoolBySymbol] = useState<Record<string, string | null>>({});
  const [reflectionPoolLoading, setReflectionPoolLoading] = useState(false);
  const [chainReadEpoch, setChainReadEpoch] = useState(0);
  const mainRef = useRef<HTMLElement>(null);
  const lastInviteAccountCheckRef = useRef<{ account: string; at: number } | null>(null);
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
    let cancelled = false;
    setReflectionPoolBySymbol({});
    setReflectionPoolLoading(true);
    void (async () => {
      try {
        const pairs = await Promise.all(
          tokens.map(async (t) => {
            const pool = await fetchReflectionPoolBalance(t.contract, t.symbol);
            return [t.symbol, pool] as const;
          })
        );
        if (!cancelled) setReflectionPoolBySymbol(Object.fromEntries(pairs));
      } catch {
        if (!cancelled) setReflectionPoolBySymbol({});
      } finally {
        if (!cancelled) setReflectionPoolLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [chainReadEpoch]);

  const poolRows = poolsByContract[selectedToken.contract] ?? [];
  const poolsLoaded = poolRows.length > 0;
  const selectedReflectionPoolRaw = reflectionPoolBySymbol[selectedToken.symbol];

  const loadFlexPools = async () => {
    setLoadingPools(true);
    try {
      const rows = await fetchFlexPools(selectedToken.contract);
      if (!rows.length) {
        toast.error('No flex pools returned for this contract.');
        return;
      }
      setPoolsByContract((prev) => ({ ...prev, [selectedToken.contract]: rows }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load flex pools.');
    } finally {
      setLoadingPools(false);
    }
  };

  /** Public chain read: prefetch flex pool rows for every flex token so reward options work without a wallet. */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const entries = await Promise.all(
        tokens.map(async (t) => {
          try {
            const rows = await fetchFlexPools(t.contract);
            return [t.contract, rows] as const;
          } catch {
            return [t.contract, [] as FlexPoolRow[]] as const;
          }
        })
      );
      if (cancelled) return;
      setPoolsByContract((prev) => {
        const next = { ...prev };
        for (const [contract, rows] of entries) {
          if (rows.length) next[contract] = rows;
        }
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** When on-chain pools arrive and nothing is selected yet, default to the first pool for the current contract. */
  useEffect(() => {
    const rows = poolsByContract[selectedToken.contract] ?? [];
    if (!rows.length || selectedPoolRowId !== null) return;
    const first = rows[0];
    if (!first) return;
    setSelectedPoolRowId(String(first.id));
    setRewardSymbol(flexPoolRewardSymbol(first));
  }, [poolsByContract, selectedToken.contract, selectedPoolRowId]);

  useEffect(() => {
    const root = mainRef.current;
    if (!root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        const sectionId = visible?.target.id;
        if (!sectionId) return;
        const navId = NAV_SECTION_ALIASES[sectionId] ?? sectionId;
        if (navItems.some((item) => item.id === navId)) setActiveSection(navId);
      },
      { root, threshold: [0.45, 0.65, 0.85] }
    );

    const observeIds = new Set([
      ...navItems.map((item) => item.id),
      ...Object.keys(NAV_SECTION_ALIASES),
    ]);
    observeIds.forEach((id) => {
      const section = document.getElementById(id);
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

  useEffect(() => {
    if (!actor || loading) {
      setInviteProgramStatus(null);
      setInviteProgramLoading(false);
      return;
    }
    let cancelled = false;
    setInviteProgramLoading(true);
    fetchEasyInviteProgramStatus(actor)
      .then((status) => {
        if (!cancelled) setInviteProgramStatus(status);
      })
      .catch(() => {
        if (!cancelled) setInviteProgramStatus(null);
      })
      .finally(() => {
        if (!cancelled) setInviteProgramLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [actor, loading, chainReadEpoch]);

  useEffect(() => {
    if (!actor || loading) {
      setAskWelcomeAccount('');
      return;
    }
    setAskWelcomeAccount(actor);
  }, [actor, loading]);

  useEffect(() => {
    if (!actor || loading || !inviteProgramStatus?.inProgram) {
      setInviteRequests([]);
      setInviteRequestsLoading(false);
      return;
    }
    let cancelled = false;
    setInviteRequestsLoading(true);
    fetchEasyInviteRequests()
      .then((rows) => {
        if (!cancelled) setInviteRequests(rows);
      })
      .catch(() => {
        if (!cancelled) setInviteRequests([]);
      })
      .finally(() => {
        if (!cancelled) setInviteRequestsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [actor, loading, inviteProgramStatus?.inProgram, chainReadEpoch]);

  useEffect(() => {
    if (!inviteRequests.length) {
      setInviteRequestMessages({});
      return;
    }
    let cancelled = false;
    fetchInviteRequestMessages(inviteRequests.map((row) => row.account))
      .then((map) => {
        if (cancelled) return;
        const messages: Record<string, string> = {};
        for (const [account, row] of map) messages[account] = row.message;
        setInviteRequestMessages(messages);
      })
      .catch(() => {
        if (!cancelled) setInviteRequestMessages({});
      });
    return () => {
      cancelled = true;
    };
  }, [inviteRequests]);

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const submitAction = useCallback(async (label: string, actions: FlexAction[]) => {
    if (!isLoggedIn || !actor) {
      toast.error('Connect a wallet first.');
      return;
    }

    setSubmitting(label);
    try {
      const result = await transact(actions);
      const txId = extractBroadcastTxId(result);
      const message =
        label === 'Welcome program' || label === 'Request a welcome' || label === 'Welcome Back'
          ? `${label} sent.`
          : `${label} sent for ${selectedToken.symbol}.`;
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
      setChainReadEpoch((n) => n + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `${label} failed.`);
    } finally {
      setSubmitting(null);
    }
  }, [actor, isLoggedIn, selectedToken.symbol, transact]);

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
    if (!isStorexWebAuthSigner(activeWallet)) {
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

  const checkInviteAccountOnBlur = async () => {
    const account = inviteAccount.trim().toLowerCase();
    if (!account) {
      setInviteAccountStatus(null);
      return;
    }
    if (!EASY_INVITE_ACCOUNT_RE.test(account)) {
      setInviteAccountStatus({ account, exists: false, registered: false });
      toast.error('Enter a valid XPR account name.');
      return;
    }

    const now = Date.now();
    const lastCheck = lastInviteAccountCheckRef.current;
    if (lastCheck && now - lastCheck.at < 5000) {
      return;
    }

    lastInviteAccountCheckRef.current = { account, at: now };
    setInviteAccountChecking(true);
    try {
      const status = await fetchEasyInviteAccountStatus(account);
      setInviteAccountStatus(status);
      if (!status.exists) {
        toast.error(`${account} does not exist on XPR Network yet.`);
      } else if (status.registered) {
        toast.error(`${account} has already been welcomed into the program.`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not check that account.');
    } finally {
      setInviteAccountChecking(false);
    }
  };

  const sendEasyLifeInvite = () => {
    const account = inviteAccount.trim().toLowerCase();
    if (!isLoggedIn || !actor) {
      toast.error('Connect a wallet first.');
      return;
    }
    if (!EASY_INVITE_ACCOUNT_RE.test(account)) {
      toast.error('Enter a valid XPR account name.');
      return;
    }
    if (inviteAccountStatus?.account !== account || !inviteAccountStatus.exists) {
      toast.error('Tap out of the account field so we can check the account first.');
      return;
    }
    if (inviteAccountStatus.registered) {
      toast.error('That account has already been welcomed.');
      return;
    }

    const amount = Number(inviteAmount);
    if (!Number.isFinite(amount) || amount < EASY_INVITE_MIN_AMOUNT) {
      toast.error(`Welcome amount must be at least ${EASY_INVITE_MIN_AMOUNT} EASY.`);
      return;
    }

    submitAction('Welcome program', [
      {
        account: EASY_INVITE_TOKEN_CONTRACT,
        name: 'transfer',
        data: {
          from: actor,
          to: EASY_INVITE_CONTRACT,
          quantity: `${amount.toFixed(6)} EASY`,
          memo: `${account}|${inviteMemo.trim() || EASY_INVITE_DEFAULT_MEMO}`,
        },
      },
    ]);
  };

  const sendWelcomeFromQueue = useCallback(
    ({ account, amount, memo }: { account: string; amount: number; memo: string }) => {
      if (!isLoggedIn || !actor) {
        toast.error('Connect a wallet first.');
        return;
      }
      if (!EASY_INVITE_ACCOUNT_RE.test(account)) {
        toast.error('Enter a valid XPR account name.');
        return;
      }
      if (!Number.isFinite(amount) || amount < EASY_INVITE_MIN_AMOUNT) {
        toast.error(`Welcome amount must be at least ${EASY_INVITE_MIN_AMOUNT} EASY.`);
        return;
      }

      void fetchEasyInviteAccountStatus(account)
        .then((status) => {
          if (!status.exists) {
            toast.error(`${account} does not exist on XPR Network yet.`);
            return;
          }
          if (status.registered) {
            toast.error('That account has already been welcomed.');
            return;
          }
          submitAction('Welcome program', [
            {
              account: EASY_INVITE_TOKEN_CONTRACT,
              name: 'transfer',
              data: {
                from: actor,
                to: EASY_INVITE_CONTRACT,
                quantity: `${amount.toFixed(6)} EASY`,
                memo: `${account}|${memo.trim() || EASY_INVITE_DEFAULT_MEMO}`,
              },
            },
          ]);
          setExpandedInviteRequest(null);
        })
        .catch((err) => {
          toast.error(err instanceof Error ? err.message : 'Could not check that account.');
        });
    },
    [actor, isLoggedIn, submitAction]
  );

  const sendWelcomeBackFromQueue = useCallback(
    ({ account, amount, memo }: { account: string; amount: number; memo: string }) => {
      if (!isLoggedIn || !actor) {
        toast.error('Connect a wallet first.');
        return;
      }
      const target = account.trim().toLowerCase();
      if (!EASY_INVITE_ACCOUNT_RE.test(target)) {
        toast.error('Enter a valid XPR account name.');
        return;
      }
      if (target === actor) {
        toast.error('You cannot Welcome Back your own account.');
        return;
      }

      const detail = expandedInviteRequest;
      const minEasy =
        detail?.account === target && detail.score !== undefined
          ? welcomeBackMinimumEasy(detail.score)
          : EASY_INVITE_MIN_AMOUNT;

      if (!Number.isFinite(amount) || amount < minEasy) {
        toast.error(`Welcome Back requires at least ${minEasy} EASY for this account.`);
        return;
      }

      submitAction('Welcome Back', [
        {
          account: EASY_INVITE_TOKEN_CONTRACT,
          name: 'transfer',
          data: {
            from: actor,
            to: EASY_INVITE_CONTRACT,
            quantity: `${amount.toFixed(6)} EASY`,
            memo: `${target}|${memo.trim() || EASY_REWELCOME_MEMO}`,
          },
        },
      ]);
      setExpandedInviteRequest(null);
    },
    [actor, expandedInviteRequest, isLoggedIn, submitAction]
  );

  const openNetworkNodeDialog = useCallback(
    (node: { id: string; score: number; banked: string; invitedby: string }, downstreamCount?: number) => {
      setExpandedInviteRequest({
        account: node.id,
        requester: node.invitedby,
        message: '',
        score: node.score,
        banked: node.banked,
        downstreamCount,
      });
    },
    []
  );

  const sendWelcomeBackBranch = useCallback(
    async (account: string) => {
      const target = account.trim().toLowerCase();
      if (!isLoggedIn || !actor) {
        toast.error('Connect a wallet first.');
        return;
      }
      if (!EASY_INVITE_ACCOUNT_RE.test(target)) {
        toast.error('That branch account is not a valid XPR account.');
        return;
      }
      if (target === actor) {
        toast.error('You cannot Welcome Back your own account.');
        return;
      }

      let targetScore = 0;
      try {
        const targetAdopter = await fetchEasyInviteAdopter(target);
        if (targetAdopter) targetScore = targetAdopter.score;
      } catch {
        toast.error('Could not load that account’s invite score for Welcome Back pricing.');
        return;
      }

      const minEasy = welcomeBackMinimumEasy(targetScore);
      submitAction('Welcome Back', [
        {
          account: EASY_INVITE_TOKEN_CONTRACT,
          name: 'transfer',
          data: {
            from: actor,
            to: EASY_INVITE_CONTRACT,
            quantity: `${minEasy.toFixed(6)} EASY`,
            memo: `${target}|${EASY_REWELCOME_MEMO}`,
          },
        },
      ]);
    },
    [actor, isLoggedIn, submitAction]
  );

  const submitAsk4Invite = useCallback(
    ({ account, requester, request, nationIso3 }: Ask4InviteSubmitPayload) => {
      if (!isLoggedIn || !actor) {
        toast.error('Connect a wallet first.');
        return;
      }
      if (inviteProgramStatus?.inProgram) {
        toast.error('You are already in the Welcome Program.');
        return;
      }
      if (!EASY_INVITE_ACCOUNT_RE.test(requester) || !EASY_INVITE_ACCOUNT_RE.test(account)) {
        toast.error('Enter valid XPR account names.');
        return;
      }
      if (requester !== actor) {
        toast.error('Requester must match your connected wallet.');
        return;
      }
      if (!nationIso3) {
        toast.error('Choose your nation before submitting.');
        return;
      }
      if (!request.trim()) {
        toast.error('Invite request message is required.');
        return;
      }
      if (request.length > ASK4INVITE_MESSAGE_MAX) {
        toast.error(`Message must be ${ASK4INVITE_MESSAGE_MAX} characters or less.`);
        return;
      }

      submitAction('Request a welcome', [
        {
          account: EASY_INVITE_CONTRACT,
          name: 'ask4invite',
          data: { account, requester, request, nation_iso3: nationIso3 },
        },
      ]);

      void postInviteRequestMessage(account, requester, request).catch(() => {});
      setAsk4InviteOpen(false);
    },
    [actor, inviteProgramStatus?.inProgram, isLoggedIn, submitAction]
  );

  const requestWelcome = () => {
    if (!actor) {
      toast.error('Connect a wallet first.');
      return;
    }
    const request =
      askWelcomeMessage.trim() || 'Requesting welcome via flex.town';
    submitAsk4Invite({
      account: askWelcomeAccount.trim().toLowerCase(),
      requester: actor,
      request,
      nationIso3: askWelcomeNation,
    });
  };

  const openAsk4InviteDialog = () => {
    scrollToSection('easy-life-status');
    setAsk4InviteOpen(true);
  };

  return (
    <div className="min-h-screen overflow-hidden bg-black text-yellow-50">
      <Header
        actor={actor}
        isLoggedIn={isLoggedIn}
        loading={loading}
        wallets={wallets}
        activeId={activeId}
        onConnectWallet={addXprWallet}
        onAddWebAuth={addWebAuthWallet}
        onAddAnchor={addAnchorWallet}
        onSetActive={setActive}
        onRemoveWallet={removeWallet}
        onDisconnectAll={disconnectAll}
        navItems={navItems}
        activeSection={activeSection}
        onNavigate={scrollToSection}
        onRefreshPendingBalance={() => setChainReadEpoch((n) => n + 1)}
        pendingBalanceLoading={reflectionPoolLoading}
      />

      <main
        ref={mainRef}
        className="h-screen overflow-y-auto scroll-smooth snap-y snap-mandatory bg-[radial-gradient(circle_at_top_left,rgba(250,204,21,0.2),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(234,179,8,0.12),transparent_32%),#020202]"
      >
        <SnapSection id="tools" eyebrow="Flex town" title="New Earth Finance for the EASY life 🍹">
          <div className="w-full max-w-7xl space-y-5">
            <FlexTownStoryRotator />
            <div className="flex flex-wrap justify-center gap-3">
              {firstFoldJumpLinks.map((link) =>
                'href' in link && link.href ? (
                  <a
                    key={link.id}
                    href={link.href}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-2xl border border-yellow-300/25 bg-yellow-300/[0.08] px-5 py-3 text-sm font-bold text-yellow-100 transition hover:border-yellow-300/40 hover:bg-yellow-300/15 hover:text-yellow-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow-300"
                  >
                    <span className="text-xl leading-none" aria-hidden>
                      {link.emoji}
                    </span>
                    {link.label}
                  </a>
                ) : (
                  <button
                    key={link.id}
                    type="button"
                    onClick={() =>
                      'opensAsk4Invite' in link && link.opensAsk4Invite
                        ? openAsk4InviteDialog()
                        : scrollToSection(link.id)
                    }
                    className="inline-flex items-center gap-2 rounded-2xl border border-yellow-300/25 bg-yellow-300/[0.08] px-5 py-3 text-sm font-bold text-yellow-100 transition hover:border-yellow-300/40 hover:bg-yellow-300/15 hover:text-yellow-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow-300"
                  >
                    <span className="text-xl leading-none" aria-hidden>
                      {link.emoji}
                    </span>
                    {link.label}
                  </button>
                )
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {featureCards.map((feature) => (
                <button
                  key={feature.title}
                  type="button"
                  onClick={() => scrollToSection(feature.sectionId)}
                  className="w-full cursor-pointer rounded-[2rem] text-left transition hover:ring-2 hover:ring-yellow-300/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow-300"
                >
                  <GlassCard className="h-full">
                    <TokenThumb src={feature.image} alt="" className="h-11 w-11 rounded-xl" />
                    <h3 className="mt-4 text-xl font-black text-yellow-100">{feature.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-yellow-100/60">{feature.body}</p>
                  </GlassCard>
                </button>
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
                    const poolRaw = reflectionPoolBySymbol[token.symbol];
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
                          {reflectionPoolLoading
                            ? 'Pending …'
                            : poolRaw
                              ? `Pending ${formatFlexAssetPretty(poolRaw)}`
                              : 'Pending —'}
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
                          {submitting === 'Send rewards' ? 'Sending…' : 'Send It'}
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
                    {reflectionPoolLoading
                      ? `Pending … Min. ${selectedToken.reflectionRouteMin}`
                      : selectedReflectionPoolRaw
                        ? `Pending ${formatFlexAssetPretty(selectedReflectionPoolRaw)} Min. ${selectedToken.reflectionRouteMin}`
                        : `Pending — Min. ${selectedToken.reflectionRouteMin}`}
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
                        <h4 className="font-black text-yellow-50">Flex your Reward Token</h4>
                        <p className="text-xs text-yellow-100/55">{selectedToken.rewardAction}</p>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
                      <div className="space-y-2">
                        <Label htmlFor="reward-pool" className="text-yellow-100/80">
                          Flexible Reward Token
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
                            Flex pool list loads from chain automatically; use &quot;Load Available&quot; to refresh
                            for {selectedToken.contract} if needed.
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
                          submitting !== null ||
                          loadingPools ||
                          (poolsLoaded && (!isLoggedIn || !selectedPoolRowId))
                        }
                        className="self-end bg-yellow-300 text-black hover:bg-yellow-200"
                      >
                        {loadingPools
                          ? 'Loading...'
                          : poolsLoaded
                            ? 'Update'
                            : 'Load Available'}
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

        <SnapSection id="what" eyebrow="What is EASY" title="Buy EASY and stack more EASY forever.">
          <div className="grid w-full max-w-7xl gap-8 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-6">
              <EasyWhatStoryRotator />
              <div className="grid gap-3 sm:grid-cols-3">
                <Metric value="21M" label="Max EASY supply 100% minted" />
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
                Read in-depth about the tokens, smart contracts, and Contributors Club in our Flex Report, basically a
                white paper.
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

        <SnapSection id="money" eyebrow="The New Earth Finance" title="Financial energy channeled for planetary evolution.">
          <div className="grid w-full max-w-7xl gap-5 md:grid-cols-3">
            {[
              {
                icon: Globe2,
                title: 'True Liquid Economies',
                body:
                  '100% of supply for GRAMS, WON, and EASY "vaulted" into liquidity pools, meaning all tokens out of the pool tokens were paid for and gained backing at the time they were bought. All distributions aren\'t random inflation, they are from the transfer fee.',
              },
              {
                icon: Sprout,
                title: 'Reflexive Rewards',
                body: 'The first tokens to allow each person to pick a separate reward token and designate beneficiaries for those rewards on WON and GRAMS.',
              },
              {
                icon: Network,
                title: 'Complete Economy',
                body: 'Flex tokens work together, and cover different areas, from stables to gold to alts. They offer rewards in each other, and connect to the wider crypto economy by providing liquidity in markets with wrapped assets like XBTC.',
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

        <SnapSection id="price" eyebrow="Trading Terminal" title="Built on XPR, best on Alcor" className="hidden md:flex">
          <div className="flex w-full max-w-6xl flex-col gap-5">
            <p className="text-base leading-relaxed text-yellow-100/70">
              See live trades, know the top holders, check prices, and buy in from{' '}
              <a
                href={alcorEasyTerminal}
                target="_blank"
                rel="noopener noreferrer"
                className={inlineLinkClass}
              >
                Alcor
              </a>
              . Search in the middle-right. Open token analytics for{' '}
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
                The best way to get EASY is to swap with a stablecoin, maximum $500 at a time to avoid slippage.
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
            {howItWorksSteps.map(({ step, title, body }) => (
              <GlassCard key={step} className="p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-yellow-300 text-xl font-black text-black">
                  {step}
                </div>
                <h3 className="mt-8 text-2xl font-black text-yellow-50">{title}</h3>
                <div className="mt-4 leading-7 text-yellow-100/60">{body}</div>
              </GlassCard>
            ))}
          </div>
        </SnapSection>

        <SnapSection id="tokens" eyebrow="Core Flex Tokens" title="EASY is the foundation. WON, GRAMS, and MEME hold up the moon.">
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
                  href={`https://alcor.exchange/v/xpr/swap?input=XUSDC-xtokens&output=${token.dexToken}`}
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
              Fringe flex tokens created by volunteers that don't even flex.
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
                href="https://alcor.exchange/v/xpr/swap?input=XUSDC-xtokens&output=HARD-simpletoken"
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
                INDEX uses smart-contract buy orders to attempt a 1000:1 soft peg to XPR (currently struggling). No flex
                mechanics. INDEX uses earned pool fees to buy back on spot markets, aiming to repeg to 1000:1 XPR.
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
                href="https://alcor.exchange/v/xpr/swap?input=XUSDC-xtokens&output=INDEX-xfund"
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
                Official EASY token on Solana:{' '}
                <a
                  href={`https://orbmarkets.io/token/${EASY_SOLANA_MINT}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={inlineLinkClass}
                >
                  <span className="break-all font-mono">{EASY_SOLANA_MINT}</span>
                </a>
                .
              </p>
              <GlassCard className="space-y-4 p-6">
                <h3 className="text-2xl font-black text-yellow-50">Important Solana note</h3>
                <p className="leading-7 text-yellow-100/65">
                  Flex reflections happen on XPR Network only. EASY held on Solana does not receive reflections, and the 2%
                  fee is used for LP. Bridge to and from XPR Network on this site.
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
                      You send EASY on Solana to your personal receive address. It arrives as EASY in your XPR
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
                  You send EASY from your XPR account. It lands as EASY on Solana in the wallet you choose below.
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

        <SnapSection id="easy-life" eyebrow="The Welcome Program" title="Welcome a loved one to the EASY Life.">
          <div className="grid w-full max-w-7xl gap-5 lg:grid-cols-[0.95fr_1.05fr]">
            <GlassCard className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-black uppercase tracking-[0.22em] text-yellow-300">
                    The Welcome Program
                  </p>
                  <h3 className="mt-3 text-3xl font-black text-yellow-50">Send 200 EASY to welcome an account.</h3>
                  <p className="mt-3 leading-7 text-yellow-100/65">
                    100 EASY lifts off their wallet, and the other 100 to the yielding{' '}
                    <code className={codeInlineClass}>inbank.mon3y</code> vault. Your 200 EASY welcomes their
                    account and adds to your banked and invite scores.
                  </p>
                  <p className="mt-3 leading-7 text-yellow-100/65">
                    Can one earn faster? Have you thought of offering wallet onboarding as a service for XPR
                    greenhorns while growing your own invite score. Or you can Welcome Back any account (even{' '}
                    <code className={codeInlineClass}>reflections</code>) for 200 EASY per tetrahedral level, effectively
                    paying a premium to be their upstream, earning each time they welcome until another Welcome Back
                    occurs from the original inviter — stacking points from their networks, with half to the networker
                    and half to{' '}
                    <code className={codeInlineClass}>inbank.mon3y</code>.
                  </p>
                  <p className="mt-3 text-sm leading-6 text-yellow-100/50">
                    Anyone can welcome another account, but if you have not been welcomed yourself you are not credited
                    any referral score or banked vault share until welcomed in.
                  </p>
                </div>
                <TokenThumb src={TOKEN_LOGO.EASY} alt="" className="h-14 w-14 rounded-2xl" />
              </div>

              <div className="mt-6 grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="easy-life-account" className="text-yellow-100/80">
                    XPR account to welcome
                  </Label>
                  <Input
                    id="easy-life-account"
                    value={inviteAccount}
                    onChange={(event) => {
                      const next = event.target.value.toLowerCase();
                      setInviteAccount(next);
                      if (inviteAccountStatus && inviteAccountStatus.account !== next.trim()) {
                        setInviteAccountStatus(null);
                      }
                    }}
                    onBlur={() => void checkInviteAccountOnBlur()}
                    placeholder="Type an XPR account"
                    className="border-yellow-300/20 bg-black/70 font-mono text-yellow-50"
                  />
                  <p className="min-h-5 text-xs text-yellow-100/50">
                    {inviteAccountChecking
                      ? 'Checking account...'
                      : inviteAccountStatus?.account === inviteAccount.trim().toLowerCase()
                        ? inviteAccountStatus.exists
                          ? inviteAccountStatus.registered
                            ? 'Account exists, but is already in the program.'
                            : 'Account exists and can be welcomed.'
                          : 'Account does not exist yet. Welcome them to XPR Network first.'
                        : 'Type an XPR account'}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-[0.55fr_1fr]">
                  <div className="space-y-2">
                    <Label htmlFor="easy-life-amount" className="text-yellow-100/80">
                      EASY Welcome Package
                    </Label>
                    <Input
                      id="easy-life-amount"
                      value={inviteAmount}
                      onChange={(event) => setInviteAmount(event.target.value)}
                      inputMode="decimal"
                      className="border-yellow-300/20 bg-black/70 text-yellow-50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="easy-life-memo" className="text-yellow-100/80">
                      Message to them
                    </Label>
                    <Input
                      id="easy-life-memo"
                      value={inviteMemo}
                      onChange={(event) => setInviteMemo(event.target.value)}
                      className="border-yellow-300/20 bg-black/70 text-yellow-50"
                    />
                  </div>
                </div>

                <Button
                  type="button"
                  onClick={sendEasyLifeInvite}
                  disabled={!isLoggedIn || submitting !== null || inviteAccountChecking}
                  className="bg-yellow-300 text-black hover:bg-yellow-200"
                >
                  {submitting === 'Welcome program' ? 'Opening transaction...' : 'Welcome to the EASY Life'}
                </Button>
                <p className="text-xs leading-relaxed text-yellow-100/45">
                  Send at least 200 EASY to <code className={codeInlineClass}>invite.mon3y</code>, memo{' '}
                  <code className={codeInlineClass}>account|message</code>.
                </p>
              </div>
            </GlassCard>

            <GlassCard className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-black uppercase tracking-[0.22em] text-yellow-300">Compact guide</p>
                  <h3 className="mt-3 text-3xl font-black text-yellow-50">
                    Collective on-chain rewards, split and multiplied by your network&apos;s reach.
                  </h3>
                  <p className="mt-3 leading-7 text-yellow-100/65">
                    Every person welcomed through your downstream adds to your invite score up the chain. Your score
                    steps you up tetrahedral levels (1, 4, 10…), and that level multiplies your banked EASY for the
                    reward from the collective pool.
                  </p>
                  <p className="mt-3 leading-7 text-yellow-100/65">
                    Every member donated / was welcomed with 100+ EASY to stay permanently in the inbank vault. The
                    account that paid is credited for what they put in the vault — that banked amount later determines
                    their share of vault yield. The <code className={codeInlineClass}>invite.mon3y</code> contract
                    distributes inbank reflection yield to every member of the welcome program.
                  </p>
                </div>
                <Users className="h-10 w-10 shrink-0 text-yellow-300" />
              </div>

              <p className="mt-5 text-sm leading-6 text-yellow-100/55">
                <button
                  type="button"
                  onClick={() => scrollToSection('easy-life-branch')}
                  className="font-bold text-yellow-300 underline-offset-2 hover:text-yellow-100 hover:underline"
                >
                  View your network below
                </button>
                .
              </p>

              <button
                type="button"
                onClick={() => setEasyLifeExpanded((open) => !open)}
                className="mt-5 flex w-full items-center justify-between rounded-2xl border border-yellow-300/15 bg-yellow-300/[0.06] px-4 py-3 text-left font-bold text-yellow-100 transition hover:bg-yellow-300/10"
              >
                <span>{easyLifeExpanded ? 'Hide full economics' : 'Expand economics and levels'}</span>
                <ChevronDown
                  className={cn('h-5 w-5 transition-transform', easyLifeExpanded && 'rotate-180')}
                  aria-hidden
                />
              </button>

              {easyLifeExpanded && (
                <div className="mt-5 space-y-5">
                  <p className="text-xs text-yellow-100/45">
                    Quick read: hitting {TETRAHEDRAL_THRESHOLDS[0]}, {TETRAHEDRAL_THRESHOLDS[1]},{' '}
                    {TETRAHEDRAL_THRESHOLDS[2]} invites moves you from 1x to 2x to 3x.
                  </p>
                  <p className="text-sm leading-7 text-yellow-100/55">
                    Multiplier levels run up to <span className="font-semibold text-yellow-200">{TETRAHEDRAL_MAX_LEVEL}</span>{' '}
                    as your invite score grows. The table shows the first {TETRAHEDRAL_TABLE_ROW_COUNT} of{' '}
                    {TETRAHEDRAL_LISTED_TIER_COUNT} listed score tiers.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Metric value="200" label="Minimum welcome" />
                    <Metric value="100" label="EASY to new wallet" />
                    <Metric value="100" label="EASY to inbank vault" />
                  </div>
                  <div className="overflow-hidden rounded-2xl border border-yellow-300/15">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-yellow-300/10 text-xs uppercase tracking-[0.18em] text-yellow-200">
                        <tr>
                          <th className="px-4 py-3">Multiplier level</th>
                          <th className="px-4 py-3">Invite score (welcomes)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-yellow-300/10 text-yellow-100/70">
                        {TETRAHEDRAL_THRESHOLDS.filter((t) => t < 999999999)
                          .slice(0, TETRAHEDRAL_TABLE_ROW_COUNT)
                          .map((score, index) => (
                            <tr key={score}>
                              <td className="px-4 py-3 font-mono text-yellow-100">{index + 1}x</td>
                              <td className="px-4 py-3">{score}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-sm leading-7 text-yellow-100/55">
                    Your share of vault yield scales with banked EASY × tetrahedral level, paid from the program pool
                    against total banked in <code className={codeInlineClass}>inbank.mon3y</code>. A busier downstream
                    pushes your invite score into higher multipliers.
                  </p>
                </div>
              )}

              <div className="mt-6 rounded-[1.5rem] border border-yellow-300/15 bg-black/50 p-4">
                <p className="text-sm font-black uppercase tracking-[0.22em] text-yellow-300">
                  Welcome loved ones to XPR Network
                </p>
                <p className="mt-2 text-sm leading-6 text-yellow-100/60">
                  Preloaded invite copy below — edit it and the share buttons update live. Ask for their username when
                  they&apos;re ready for EASY on WebAuth.
                </p>
                <EasyLifeShareBar className="mt-4" />
              </div>
            </GlassCard>
          </div>
        </SnapSection>

        <SnapSection
          id="easy-life-status"
          eyebrow="Program status"
          title="Your Welcome Program status"
        >
          <GlassCard className="w-full max-w-7xl p-5 sm:p-6">
            <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
              <div className="rounded-[1.5rem] border border-yellow-300/15 bg-black/55 p-5">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-yellow-300">Current account</p>
                <h3 className="mt-3 text-2xl font-black text-yellow-50 sm:text-3xl">
                  {loading ? 'Checking...' : actor ?? 'Connect wallet'}
                </h3>

                <div className="mt-5 rounded-[1.25rem] border border-yellow-300/20 bg-yellow-300/[0.06] p-4 text-center">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-yellow-200/80">Program state</p>
                  <p
                    className={cn(
                      'mt-2 text-4xl font-black tracking-wide sm:text-5xl',
                      inviteProgramStatus?.inProgram ? 'text-emerald-300' : 'text-rose-300'
                    )}
                  >
                    {inviteProgramLoading
                      ? 'CHECKING'
                      : !actor
                        ? 'NO WALLET'
                        : inviteProgramStatus?.inProgram
                          ? 'IN'
                          : 'OUT'}
                  </p>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <Metric
                    value={
                      inviteProgramLoading
                        ? '...'
                        : inviteProgramStatus?.inProgram
                          ? String(inviteProgramStatus.score)
                          : '0'
                    }
                    label="Current score"
                  />
                  <Metric
                    value={
                      inviteProgramLoading
                        ? '...'
                        : inviteProgramStatus?.inProgram && inviteProgramStatus.rank
                          ? `#${inviteProgramStatus.rank}`
                          : '—'
                    }
                    label="Current rank"
                  />
                  <Metric
                    compact
                    value={
                      inviteProgramLoading
                        ? '...'
                        : inviteProgramStatus?.inProgram
                          ? formatFlexAssetPretty(inviteProgramStatus.banked)
                          : '0 EASY'
                    }
                    label="Banked EASY"
                  />
                </div>
                {inviteProgramStatus?.inProgram ? (
                  <p className="mt-4 text-sm leading-relaxed text-yellow-100/60">
                    <span className="font-semibold text-yellow-200">Welcome Back</span> captures the purchased
                    account&apos;s downstream (unique accounts, up to 7 levels deep; loops counted once). Cost is{' '}
                    <span className="font-semibold text-yellow-200">200 EASY</span> × their tetrahedral level from their
                    invite score — not yours.
                  </p>
                ) : null}
              </div>

              <div className="rounded-[1.5rem] border border-yellow-300/15 bg-black/55 p-5">
                {inviteProgramStatus?.inProgram ? (
                  <>
                    <p className="text-xs font-black uppercase tracking-[0.22em] text-yellow-300">
                      Pending welcome requests
                    </p>
                    <h3 className="mt-3 text-2xl font-black text-yellow-50">Accounts waiting for a welcome</h3>
                    <p className="mt-3 text-sm leading-7 text-yellow-100/65">
                      From <code className={codeInlineClass}>invite.mon3y</code> queue (
                      <code className={codeInlineClass}>invrequests</code>). Welcome the oldest next with a paid
                      transfer memo starting with <code className={codeInlineClass}>*|</code>.
                    </p>
                    {inviteRequestsLoading ? (
                      <p className="mt-4 text-sm text-yellow-100/55">Loading queue…</p>
                    ) : inviteRequests.length === 0 ? (
                      <p className="mt-4 text-sm text-yellow-100/55">No pending requests right now.</p>
                    ) : (
                      <div className="mt-4 max-h-72 overflow-auto rounded-xl border border-yellow-300/15">
                        <table className="w-full text-left text-sm">
                          <thead className="sticky top-0 bg-yellow-300/10 text-xs uppercase tracking-[0.16em] text-yellow-200">
                            <tr>
                              <th className="px-3 py-2">Account</th>
                              <th className="px-3 py-2">Requester</th>
                              <th className="px-3 py-2">Message</th>
                              <th className="px-3 py-2">Requested</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-yellow-300/10 text-yellow-100/75">
                            {inviteRequests.map((row) => (
                              <tr key={row.account}>
                                <td className="px-3 py-2 font-mono">{row.account}</td>
                                <td className="px-3 py-2 font-mono">{row.requester}</td>
                                <td className="max-w-[8rem] px-3 py-2 text-yellow-100/70">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setExpandedInviteRequest({
                                        account: row.account,
                                        requester: row.requester,
                                        message: inviteRequestMessages[row.account] ?? '',
                                      })
                                    }
                                    className="max-w-full truncate text-left font-mono text-xs text-yellow-200/90 underline decoration-yellow-300/30 underline-offset-2 hover:text-yellow-50"
                                    title="Welcome this request"
                                  >
                                    {truncateInviteMessage(inviteRequestMessages[row.account] ?? '')}
                                  </button>
                                </td>
                                <td className="px-3 py-2 text-yellow-100/55">
                                  {row.requestedAt
                                    ? new Date(row.requestedAt * 1000).toLocaleString()
                                    : '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-xs font-black uppercase tracking-[0.22em] text-yellow-300">Request a welcome</p>
                    <h3 className="mt-3 text-2xl font-black text-yellow-50">Join the invite queue</h3>
                    <p className="mt-3 text-sm leading-7 text-yellow-100/65">
                      Submits <code className={codeInlineClass}>invite.mon3y::ask4invite</code> on-chain. A generous soul
                      can later welcome you with a 200 EASY transfer to{' '}
                      <code className={codeInlineClass}>invite.mon3y</code>, memo prefix{' '}
                      <code className={codeInlineClass}>*|</code>
                      Welcome or <code className={codeInlineClass}>MEX|Bienvenidos</code> or{' '}
                      <code className={codeInlineClass}>urname|Welcome</code>.{' '}
                      <a
                        href="https://t.me/flextokens"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-yellow-200 underline decoration-yellow-300/35 underline-offset-2 hover:text-yellow-50"
                      >
                        Tell us why in Telegram
                      </a>
                    </p>
                    <div className="mt-4 space-y-2">
                      <Label htmlFor="ask-welcome-account" className="text-yellow-100/80">
                        My account
                      </Label>
                      <Input
                        id="ask-welcome-account"
                        value={askWelcomeAccount}
                        onChange={(event) => setAskWelcomeAccount(event.target.value.toLowerCase())}
                        placeholder="accountname"
                        className="border-yellow-300/20 bg-black/70 font-mono text-yellow-50"
                      />
                    </div>
                    <div className="mt-3 space-y-2">
                      <Label htmlFor="ask-welcome-message" className="text-yellow-100/80">
                        I want to join the EASY Life because
                      </Label>
                      <textarea
                        id="ask-welcome-message"
                        value={askWelcomeMessage}
                        onChange={(event) => {
                          const next = event.target.value;
                          setAskWelcomeMessage(
                            next.length > ASK4INVITE_MESSAGE_MAX ? next.slice(0, ASK4INVITE_MESSAGE_MAX) : next
                          );
                        }}
                        className="min-h-[96px] w-full resize-y rounded-md border border-yellow-300/20 bg-black/70 px-3 py-2 text-sm text-yellow-50 placeholder:text-yellow-100/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300/40"
                      />
                      <p className="text-xs text-yellow-100/45">
                        {formatAsk4InviteCharCount(askWelcomeMessage.length)}
                      </p>
                    </div>
                    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
                      <div className="min-w-0 flex-1">
                        <InviteNationSelect
                          id="ask-welcome-nation"
                          value={askWelcomeNation}
                          onValueChange={setAskWelcomeNation}
                        />
                      </div>
                      <Button
                        type="button"
                        onClick={requestWelcome}
                        disabled={
                          !isLoggedIn ||
                          submitting !== null ||
                          inviteProgramLoading ||
                          inviteProgramStatus?.inProgram === true ||
                          !askWelcomeNation
                        }
                        className="w-full shrink-0 bg-yellow-300 text-black hover:bg-yellow-200 disabled:opacity-40 sm:w-auto sm:min-w-[11rem]"
                      >
                        {submitting === 'Request a welcome' ? 'Submitting…' : 'Request a welcome'}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </GlassCard>
          <InviteQueueRequestDialog
            detail={expandedInviteRequest}
            onClose={() => setExpandedInviteRequest(null)}
            isLoggedIn={isLoggedIn}
            submitting={submitting}
            onWelcome={sendWelcomeFromQueue}
            onWelcomeBack={sendWelcomeBackFromQueue}
          />
          <Ask4InviteDialog
            open={ask4InviteOpen}
            onOpenChange={setAsk4InviteOpen}
            actor={actor}
            isLoggedIn={isLoggedIn}
            inProgram={inviteProgramStatus?.inProgram === true}
            programLoading={inviteProgramLoading}
            submitting={submitting}
            onSubmit={submitAsk4Invite}
          />
        </SnapSection>

        <SnapSection
          id="easy-life-branch"
          eyebrow="Welcome network"
          title="Branch out + Bag more Fruit"
        >
          <GlassCard className="w-full max-w-7xl p-4 sm:p-6">
            <p className="max-w-3xl text-lg font-semibold leading-8 text-yellow-100/80">
              When we work together, we grow together.
            </p>
            <p className="mt-3 max-w-3xl text-base leading-7 text-yellow-100/65">
              View your network on <code className={codeInlineClass}>invite.mon3y</code> — who you welcomed and who they
              welcomed downstream. Click any dot to see their flex chest or send Welcome Back.
            </p>
            <div className="mt-6">
              <EasyLifeBranchTree
                rootAccount={actor}
                actor={actor}
                onWelcomeBackBranch={sendWelcomeBackBranch}
                onSelectNetworkNode={openNetworkNodeDialog}
              />
            </div>
          </GlassCard>
        </SnapSection>

        <SnapSection
          id="unlock"
          eyebrow="Unlock the EASY Life"
          title="Learn LPing with EASY."
          comingSoon
        >
          <div className="w-full max-w-7xl space-y-5">
            <p className="max-w-3xl text-xl leading-9 text-yellow-100/70">
              EASY Life access is training for liquidity providing with EASY: how the pools work, how reflections
              support holders, and how to participate without guessing.
            </p>
            <div className="grid gap-4 md:grid-cols-3">
              <GlassCard className="p-6">
                <h3 className="text-3xl font-black text-yellow-50">Hold EASY</h3>
                <p className="mt-3 text-5xl font-black text-yellow-300">50K</p>
                <p className="mt-4 leading-7 text-yellow-100/60">
                  Hold 50,000 EASY, roughly 800 USD at the stated access target.
                </p>
              </GlassCard>
              <GlassCard className="p-6">
                <h3 className="text-3xl font-black text-yellow-50">Build score</h3>
                <p className="mt-3 text-5xl font-black text-yellow-300">50</p>
                <p className="mt-4 leading-7 text-yellow-100/60">
                  Reach an invite score of 50 through people you welcome and their downstream activity.
                </p>
              </GlassCard>
              <GlassCard className="p-6">
                <h3 className="text-3xl font-black text-yellow-50">Pay once</h3>
                <p className="mt-3 text-5xl font-black text-yellow-300">$250</p>
                <p className="mt-4 leading-7 text-yellow-100/60">
                  One-time regular-money access path paid directly to the EASY Life host.
                </p>
              </GlassCard>
            </div>
          </div>
        </SnapSection>

        <footer className="snap-start border-t border-yellow-300/15 bg-black/95 px-4 py-14 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl space-y-5 text-center text-xs leading-relaxed text-yellow-100/50 sm:text-sm">
            <p>
              This site is maintained by volunteers in the spirit of New Earth Finance: open tools for flex tokens on
              XPR Network, not a bank, fund, or incorporated product. There is no traditional single owner of the chain,
              contracts, or your keys. Contributors donate time and infrastructure; you choose every signature yourself.
            </p>
            <p>
              Nothing here is an offer, solicitation, or legal, tax, or investment advice. Digital assets are
              experimental and may lose all value. Described mechanics (rewards, burns, bridges or pegs) are not
              promises of future behavior. Smart contracts and interfaces can contain bugs or change without notice. By
              using the site you accept full responsibility for your wallet actions; volunteers and hosts disclaim all
              warranties and liability—including for indirect or consequential damages—to the fullest extent permitted by
              law.
            </p>
            <p className="text-yellow-100/40">
              Built on XPR Network. Confirm accounts, amounts, and actions on a block explorer before high-value
              transactions.
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
  className,
  comingSoon,
}: {
  id: string;
  eyebrow: string;
  title: string;
  children: React.ReactNode;
  className?: string;
  comingSoon?: boolean;
}) {
  const header = (
    <div className="mb-8 w-full max-w-7xl">
      <p className="text-sm font-black uppercase tracking-[0.34em] text-yellow-300">{eyebrow}</p>
      <h2 className="mt-4 max-w-5xl text-4xl font-black tracking-tight text-yellow-50 sm:text-6xl lg:text-7xl">
        {title}
      </h2>
    </div>
  );

  return (
    <section
      id={id}
      className={cn(
        'relative flex min-h-screen snap-start flex-col items-center justify-center overflow-hidden px-4 pb-12 pt-28 sm:px-6 lg:px-8',
        className
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(250,204,21,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(250,204,21,0.04)_1px,transparent_1px)] bg-[size:72px_72px]" />
      {comingSoon ? (
        <>
          <div
            className="relative z-10 flex w-full max-w-7xl flex-col items-center blur-md opacity-45 pointer-events-none select-none"
            aria-hidden
          >
            {header}
            <div className="flex w-full justify-center">{children}</div>
          </div>
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center px-4">
            <p className="text-center text-4xl font-black uppercase tracking-[0.28em] text-yellow-50 drop-shadow-[0_2px_32px_rgba(0,0,0,0.95)] sm:text-6xl lg:text-7xl">
              COMING SOON
            </p>
          </div>
        </>
      ) : (
        <>
          <div className="relative z-10 mb-8 w-full max-w-7xl">
            <p className="text-sm font-black uppercase tracking-[0.34em] text-yellow-300">{eyebrow}</p>
            <h2 className="mt-4 max-w-5xl text-4xl font-black tracking-tight text-yellow-50 sm:text-6xl lg:text-7xl">
              {title}
            </h2>
          </div>
          <div className="relative z-10 flex w-full justify-center">{children}</div>
        </>
      )}
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

function Metric({
  value,
  label,
  compact,
}: {
  value: string;
  label: string;
  compact?: boolean;
}) {
  return (
    <div className="rounded-[1.5rem] border border-yellow-300/15 bg-yellow-300/[0.05] p-4 sm:p-5">
      <div
        className={cn(
          'font-black text-yellow-300 break-words',
          compact ? 'text-lg leading-tight sm:text-xl' : 'text-4xl'
        )}
      >
        {value}
      </div>
      <div className="mt-2 text-sm uppercase tracking-[0.18em] text-yellow-100/55">{label}</div>
    </div>
  );
}

export default Index;
