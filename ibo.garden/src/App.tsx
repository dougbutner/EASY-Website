import { JupiterIboSwap } from '@/components/JupiterIboSwap';
import { MarketGrid } from '@/components/MarketGrid';
import { SnapSection } from '@/components/SnapSection';
import { StickyNav } from '@/components/StickyNav';
import {
  DISCLAIMER,
  EXPLORER_MINT_URL,
  IBO_MINT,
  JUPITER_SWAP_URL,
  LIQUIDITY_COPY,
  navItems,
  ORCA_SWAP_URL,
  SITE_NAME,
  SOURCE_STORY,
  SOL_MINT,
  TAGLINE,
  TOKEN_SYMBOL,
  type NavSectionId,
} from '@/constants/ibo';
import { shortenMint } from '@/lib/utils';
import { loadIboMarkets, type MarketConfig } from '@/services/markets';
import { Copy, ExternalLink, Sprout } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

const sectionIds = navItems.map((n) => n.id);

function App() {
  const mainRef = useRef<HTMLElement>(null);
  const [activeSection, setActiveSection] = useState<NavSectionId>('hero');
  const [markets, setMarkets] = useState<MarketConfig[]>([]);
  const [selectedMarket, setSelectedMarket] = useState<MarketConfig | null>(null);
  const [marketsLoading, setMarketsLoading] = useState(true);
  const [marketsStatus, setMarketsStatus] = useState<string | undefined>();
  const [tokenSymbol, setTokenSymbol] = useState(TOKEN_SYMBOL);
  const [storyIndex, setStoryIndex] = useState(0);

  const scrollToSection = useCallback((id: NavSectionId) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  useEffect(() => {
    const root = mainRef.current;
    if (!root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        const id = visible?.target.id as NavSectionId | undefined;
        if (id && sectionIds.includes(id)) setActiveSection(id);
      },
      { root, threshold: [0.45, 0.65, 0.85] }
    );

    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    setMarketsLoading(true);
    void loadIboMarkets().then((result) => {
      if (cancelled) return;
      setMarkets(result.markets);
      setMarketsStatus(result.error);
      if (result.tokenSymbol) setTokenSymbol(result.tokenSymbol);
      const preferred =
        result.markets.find((m) => m.inputMint === SOL_MINT) ?? result.markets[0] ?? null;
      setSelectedMarket(preferred);
      setMarketsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const t = window.setInterval(() => {
      setStoryIndex((i) => (i + 1) % SOURCE_STORY.length);
    }, 7000);
    return () => window.clearInterval(t);
  }, []);

  const copyMint = () => {
    void navigator.clipboard?.writeText(IBO_MINT);
  };

  const swapInputMint = selectedMarket?.inputMint ?? SOL_MINT;

  return (
    <div className="min-h-screen overflow-hidden text-stone-100">
      <StickyNav activeSection={activeSection} onNavigate={scrollToSection} />

      <main
        ref={mainRef}
        className="h-screen overflow-y-auto scroll-smooth snap-y snap-mandatory bg-[radial-gradient(circle_at_top_left,rgba(45,106,79,0.22),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(212,163,115,0.1),transparent_32%),#050806]"
      >
        <SnapSection id="hero" eyebrow={SITE_NAME} title={TAGLINE}>
          <div className="w-full max-w-6xl space-y-8 text-center sm:text-left">
            <p className="mx-auto max-w-2xl text-lg leading-relaxed text-stone-300 sm:mx-0">
              The on-chain garden for {tokenSymbol} — trade across Orca Whirlpool liquidity and swap into the
              mint below.
            </p>
            <div className="glass-panel mx-auto flex max-w-xl flex-col gap-3 p-5 sm:mx-0">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-garden-moss">Mint</p>
              <p className="break-all font-mono text-sm text-stone-200">{IBO_MINT}</p>
              <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
                <button
                  type="button"
                  onClick={copyMint}
                  className="inline-flex items-center gap-2 rounded-full border border-garden-moss/30 px-4 py-2 text-xs font-bold uppercase tracking-wider hover:bg-garden-moss/20"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copy
                </button>
                <a
                  href={EXPLORER_MINT_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full bg-garden-moss px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#050806] hover:bg-garden-green"
                >
                  Solscan
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          </div>
        </SnapSection>

        <SnapSection id="source" eyebrow="Origin" title="Farm-sourced story">
          <div className="w-full max-w-6xl">
            <div className="glass-panel flex gap-4 p-6 sm:p-8">
              <Sprout className="h-10 w-10 shrink-0 text-garden-amber" aria-hidden />
              <p className="text-lg leading-relaxed text-stone-300 transition-opacity duration-500">
                {SOURCE_STORY[storyIndex]}
              </p>
            </div>
          </div>
        </SnapSection>

        <SnapSection id="markets" eyebrow="Markets" title="Whirlpool & swap routes">
          <MarketGrid
            markets={markets}
            selectedId={selectedMarket?.id ?? null}
            onSelect={(m) => {
              setSelectedMarket(m);
              scrollToSection('swap');
            }}
            loading={marketsLoading}
            statusMessage={marketsStatus}
          />
        </SnapSection>

        <SnapSection id="swap" eyebrow="Swap" title={`Trade into ${tokenSymbol}`}>
          <div className="grid w-full max-w-6xl items-start gap-8 lg:grid-cols-[0.85fr_1.15fr]">
            <div className="space-y-4">
              <p className="text-lg leading-8 text-stone-300">
                Built-in Jupiter swap routes through Orca and other Solana liquidity. Selected market:{' '}
                <span className="font-bold text-garden-moss">
                  {selectedMarket?.label ?? 'SOL → IBO'}
                </span>
                .
              </p>
              <a
                href={JUPITER_SWAP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex rounded-full border border-garden-moss/40 px-5 py-3 text-sm font-bold uppercase tracking-[0.16em] hover:bg-garden-moss/20"
              >
                Open on jup.ag
              </a>
            </div>
            <div className="w-full overflow-hidden rounded-[2rem] border border-garden-moss/25 bg-black/60">
              <JupiterIboSwap key={swapInputMint} inputMint={swapInputMint} />
            </div>
          </div>
        </SnapSection>

        <SnapSection id="liquidity" eyebrow="Liquidity" title="Concentrated pools on Orca">
          <div className="w-full max-w-6xl space-y-6">
            <p className="max-w-3xl text-lg leading-8 text-stone-300">{LIQUIDITY_COPY}</p>
            <div className="flex flex-wrap gap-3">
              <a
                href={ORCA_SWAP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-garden-amber px-5 py-3 text-sm font-bold uppercase tracking-[0.14em] text-[#050806] hover:opacity-90"
              >
                Orca swap
                <ExternalLink className="h-4 w-4" />
              </a>
              <a
                href={`https://www.orca.so/?tokenIn=${IBO_MINT}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-garden-moss/40 px-5 py-3 text-sm font-bold uppercase tracking-[0.14em] hover:bg-garden-green/20"
              >
                Explore pools
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
            {!marketsLoading && markets.filter((m) => m.venue === 'orca-whirlpool').length > 0 ? (
              <ul className="glass-panel divide-y divide-garden-moss/15 p-4 text-sm text-stone-400">
                {markets
                  .filter((m) => m.venue === 'orca-whirlpool')
                  .slice(0, 8)
                  .map((m) => (
                    <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                      <span className="font-medium text-stone-200">{m.label}</span>
                      <a
                        href={m.externalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-garden-moss hover:underline"
                      >
                        Pool ↗
                      </a>
                    </li>
                  ))}
              </ul>
            ) : null}
          </div>
        </SnapSection>

        <SnapSection id="token" eyebrow="Token" title={`${tokenSymbol} on Solana`}>
          <div className="w-full max-w-6xl space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <Stat label="Symbol" value={tokenSymbol} />
              <Stat label="Mint" value={shortenMint(IBO_MINT, 8, 8)} />
              <Stat label="Chain" value="Solana" />
              <Stat label="Venues" value="Orca Whirlpool · Jupiter" />
            </div>
            <p className="text-sm leading-relaxed text-stone-500">{DISCLAIMER}</p>
          </div>
        </SnapSection>

        <footer className="snap-start border-t border-garden-moss/20 bg-black/90 px-4 py-12 text-center text-xs text-stone-500 sm:px-6">
          <p className="mx-auto max-w-2xl">{DISCLAIMER}</p>
          <p className="mt-4">
            <a href={EXPLORER_MINT_URL} className="text-garden-moss hover:underline">
              {shortenMint(IBO_MINT)}
            </a>
            {' · '}
            ibo.garden
          </p>
        </footer>
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass-panel px-5 py-4">
      <p className="text-xs uppercase tracking-[0.18em] text-stone-500">{label}</p>
      <p className="mt-2 font-mono text-lg font-bold text-stone-100">{value}</p>
    </div>
  );
}

export default App;
