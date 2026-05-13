/**
 * Index page — EASY one-page snap-scroll landing and token tools.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Header } from '@/components/Header';
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
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
  ExternalLink,
  Globe2,
  HelpCircle,
  Network,
  Send,
  ShieldOff,
  Sparkles,
  Sprout,
  TreePine,
} from 'lucide-react';
import { toast } from 'sonner';

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
  { id: 'tools', label: 'Tools' },
  { id: 'what', label: 'What Is EASY' },
  { id: 'money', label: 'Mon3y' },
  { id: 'price', label: 'Price' },
  { id: 'swap', label: 'Swap' },
  { id: 'works', label: 'How It Works' },
  { id: 'tokens', label: 'Flex Tokens' },
];

const tokens: TokenConfig[] = [
  {
    symbol: 'EASY',
    contract: 'mon3y',
    title: 'Take it EASY',
    tagline: 'The first customizable-reflection Flex token.',
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
    title: 'We WON',
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
    title: 'GM Degens',
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

const alcorEasySwap = 'https://alcor.exchange/v/xpr/swap?input=XUSDC-xtokens&output=EASY-mon3y';
const alcorEasyChart = 'https://alcor.exchange/v/xpr/chart-widget?input=XUSDC-xtokens&output=EASY-mon3y';
const alcorEasySwapWidget = 'https://alcor.exchange/v/xpr/swap-widget?input=XUSDC-xtokens&output=EASY-mon3y';

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
  } = useProton();
  const [activeSection, setActiveSection] = useState(navItems[0].id);
  const [selectedSymbol, setSelectedSymbol] = useState('EASY');
  const [rewardSymbol, setRewardSymbol] = useState('EASY');
  const [treeAccount, setTreeAccount] = useState('');
  const [treeRate, setTreeRate] = useState('10000');
  const [customMemo, setCustomMemo] = useState('Thanks @@ for stacking $$ ** with EASY.');
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [poolsByContract, setPoolsByContract] = useState<Record<string, FlexPoolRow[]>>({});
  const [selectedPoolRowId, setSelectedPoolRowId] = useState<string | null>(null);
  const [loadingPools, setLoadingPools] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const [wonLogoUrl] = useState(() => pickRandomWonVariant());

  const selectedToken = useMemo(
    () => tokens.find((token) => token.symbol === selectedSymbol) ?? tokens[0],
    [selectedSymbol]
  );

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
      await transact(actions);
      toast.success(`${label} sent for ${selectedToken.symbol}.`);
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
    submitAction('Tax opt-out', [
      {
        account: selectedToken.contract,
        name: selectedToken.optOutAction,
        data: { account: actor, ban_status: true },
      },
    ]);

  const setInheritance = () => {
    if (!selectedToken.treeAction) return;
    submitAction('Inheritance route', [
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
    submitAction('Custom memo', [
      {
        account: selectedToken.contract,
        name: selectedToken.memoAction,
        data: { flexer: actor, custom_memo: customMemo },
      },
    ]);
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
        <SnapSection id="tools" eyebrow="EASY Tools" title="New earth finance for the EASY life.">
          <div className="grid w-full max-w-7xl gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="space-y-5">
              <p className="max-w-xl text-lg text-yellow-100/70">
                Send rewards, change your reward token, or opt out of tax (warning, permanant). Pick a Flex token
                and take control.
              </p>
              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                {featureCards.map((feature) => (
                  <GlassCard key={feature.title}>
                    <TokenThumb src={feature.image} alt="" className="h-11 w-11 rounded-xl" />
                    <h3 className="mt-4 text-xl font-black text-yellow-100">{feature.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-yellow-100/60">{feature.body}</p>
                  </GlassCard>
                ))}
              </div>
            </div>

            <GlassCard className="p-4 sm:p-6">
              <div className="rounded-[2rem] border border-yellow-300/15 bg-black/60 p-2">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {tokens.map((token) => {
                    const selected = token.symbol === selectedSymbol;
                    return (
                      <div
                        key={token.symbol}
                        className={cn(
                          'rounded-[1.35rem] px-4 py-3 text-left transition',
                          selected
                            ? 'bg-yellow-300 text-black shadow-[0_0_30px_rgba(250,204,21,0.28)]'
                            : 'bg-yellow-300/5 text-yellow-100 hover:bg-yellow-300/10'
                        )}
                      >
                        <TokenThumb
                          src={tokenLogoUrl(token, wonLogoUrl)}
                          alt={token.symbol}
                          className="mb-2 h-10 w-10 rounded-lg"
                        />
                        <button
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
                          className="block w-full text-left text-xs font-black uppercase tracking-[0.22em]"
                        >
                          {token.symbol}
                        </button>
                        <a
                          href={token.explorerUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 inline-flex items-center gap-1 text-xs opacity-70 underline-offset-2 hover:underline"
                        >
                          {token.contract}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
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
                  <Button
                    type="button"
                    onClick={sendRewards}
                    disabled={!isLoggedIn || submitting !== null}
                    className="mt-6 w-full bg-yellow-300 text-black hover:bg-yellow-200"
                  >
                    <Send className="mr-2 h-4 w-4" />
                    {submitting === 'Send rewards' ? 'Sending...' : `Send Rewards (${selectedToken.sendAction})`}
                  </Button>
                </div>

                <div className="space-y-4">
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

                  {selectedToken.treeAction && selectedToken.memoAction && (
                    <div className="rounded-[2rem] border border-yellow-300/15 bg-black/50 p-5">
                      <div className="flex items-center gap-3">
                        <TreePine className="h-5 w-5 text-yellow-300" />
                        <div>
                          <h4 className="font-black text-yellow-50">Inheritance / Tree Routing</h4>
                          <p className="text-xs text-yellow-100/55">
                            {selectedToken.treeAction} + {selectedToken.memoAction}
                          </p>
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
                      <div className="mt-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <Label htmlFor="tree-memo" className="text-yellow-100/80">
                            Custom memo
                          </Label>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                aria-label="Custom memo shortcode help"
                                className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-yellow-300/30 text-yellow-200 hover:bg-yellow-300 hover:text-black"
                              >
                                <HelpCircle className="h-3.5 w-3.5" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs border-yellow-300/25 bg-black text-yellow-50">
                              <div className="space-y-1 text-xs">
                                <p>
                                  <span className="font-mono text-yellow-300">@@</span> becomes the recipient
                                  account.
                                </p>
                                <p>
                                  <span className="font-mono text-yellow-300">$$</span> becomes the reward amount.
                                </p>
                                <p>
                                  <span className="font-mono text-yellow-300">**</span> becomes the token symbol.
                                </p>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <Textarea
                          id="tree-memo"
                          value={customMemo}
                          onChange={(event) => setCustomMemo(event.target.value)}
                          className="min-h-20 border-yellow-300/20 bg-black/70 text-yellow-50"
                        />
                      </div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <Button
                          type="button"
                          onClick={setInheritance}
                          disabled={!isLoggedIn || submitting !== null || !treeAccount.trim()}
                          className="bg-yellow-300 text-black hover:bg-yellow-200"
                        >
                          Set Route
                        </Button>
                        <Button
                          type="button"
                          onClick={setInheritanceMemo}
                          disabled={!isLoggedIn || submitting !== null}
                          variant="outline"
                          className="border-yellow-300/30 bg-black/50 text-yellow-100 hover:bg-yellow-300 hover:text-black"
                        >
                          Set Memo
                        </Button>
                      </div>
                    </div>
                  )}

                  <Button
                    type="button"
                    onClick={optOutOfTax}
                    disabled={!isLoggedIn || submitting !== null}
                    variant="outline"
                    className="w-full border-red-400/30 bg-red-500/10 text-red-100 hover:bg-red-400 hover:text-black"
                  >
                    <ShieldOff className="mr-2 h-4 w-4" />
                    Opt Out of Tax ({selectedToken.optOutAction})
                  </Button>
                </div>
              </div>
            </GlassCard>
          </div>
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
              <h3 className="mt-8 text-4xl font-black text-yellow-50">Take it EASY.</h3>
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

        <SnapSection id="money" eyebrow="The New Earth Mon3y" title="Financial energy, routed better.">
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

        <SnapSection id="price" eyebrow="EASY Price Graph" title="Live Alcor market view.">
          <div className="w-full max-w-6xl overflow-hidden rounded-[2rem] border border-yellow-300/20 bg-black/70 shadow-[0_0_70px_rgba(234,179,8,0.12)]">
            <iframe
              title="EASY price graph on Alcor"
              src={alcorEasyChart}
              className="h-[68vh] w-full bg-black"
              loading="lazy"
            />
          </div>
          <a
            href="https://alcor.exchange/v/xpr/analytics/tokens/easy-mon3y"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 text-sm font-bold uppercase tracking-[0.2em] text-yellow-300 hover:text-yellow-100"
          >
            Open full analytics
          </a>
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

        <SnapSection id="tokens" eyebrow="Other Flex Tokens" title="EASY is the gateway. WON, GRAMS, and MEME add flavor.">
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
                  href={`https://alcor.exchange/v/xpr/swap?input=XUSDC-xtokens&output=${token.dexToken}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-6 inline-flex items-center justify-center rounded-full border border-yellow-300/25 px-5 py-3 text-sm font-black uppercase tracking-[0.16em] text-yellow-200 hover:bg-yellow-300 hover:text-black"
                >
                  Swap {token.symbol}
                </a>
              </GlassCard>
            ))}
          </div>
          <footer className="mt-8 text-center text-sm text-yellow-100/45">
            Built on XPR Network. Token mechanics can change; verify contract actions before high-value calls.
          </footer>
        </SnapSection>
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
