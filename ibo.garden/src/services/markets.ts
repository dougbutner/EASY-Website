import { FALLBACK_MARKETS, IBO_MINT, SOL_MINT, USDC_MINT } from '@/constants/ibo';

export type MarketVenue = 'orca-whirlpool' | 'jupiter-route';

export type MarketConfig = {
  id: string;
  venue: MarketVenue;
  inputMint: string;
  outputMint: string;
  label: string;
  feeRate?: string;
  liquidityUsd?: number;
  volume24hUsd?: number;
  externalUrl: string;
};

const KNOWN_SYMBOLS: Record<string, string> = {
  [SOL_MINT]: 'SOL',
  [USDC_MINT]: 'USDC',
  [IBO_MINT]: 'IBO',
};

function symbolForMint(mint: string, name?: string): string {
  if (KNOWN_SYMBOLS[mint]) return KNOWN_SYMBOLS[mint];
  if (name) return name.slice(0, 8).toUpperCase();
  return mint.slice(0, 4);
}

function pairLabel(inputMint: string, outputMint: string, inputName?: string, outputName?: string): string {
  const a = symbolForMint(inputMint, inputName);
  const b = symbolForMint(outputMint, outputName);
  return `${a} → ${b}`;
}

function jupiterSwapUrl(inputMint: string, outputMint: string): string {
  return `https://jup.ag/swap/${inputMint}-${outputMint}`;
}

function orcaPoolUrl(poolAddress: string): string {
  return `https://www.orca.so/pools/${poolAddress}`;
}

type JupiterTokenRow = {
  id?: string;
  symbol?: string;
  name?: string;
};

async function fetchJupiterTokenMeta(mint: string): Promise<JupiterTokenRow | null> {
  try {
    const res = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(mint)}`);
    if (!res.ok) return null;
    const data = (await res.json()) as JupiterTokenRow[];
    if (!Array.isArray(data)) return null;
    return data.find((t) => t.id === mint) ?? data[0] ?? null;
  } catch {
    return null;
  }
}

/** Orca API v2 — pools that include the token mint. */
async function fetchOrcaPoolsForMint(mint: string): Promise<MarketConfig[]> {
  const markets: MarketConfig[] = [];
  try {
    const url = `https://api.orca.so/v2/solana/pools?tokenMint=${encodeURIComponent(mint)}`;
    const res = await fetch(url);
    if (!res.ok) return markets;
    const json = (await res.json()) as {
      data?: Array<{
        address?: string;
        feeRate?: number;
        tvlUsdc?: string | number;
        volume24h?: string | number;
        tokenA?: { address?: string; symbol?: string };
        tokenB?: { address?: string; symbol?: string };
      }>;
    };
    const pools = json.data ?? [];
    for (const pool of pools) {
      const addr = pool.address;
      const tokenA = pool.tokenA?.address;
      const tokenB = pool.tokenB?.address;
      if (!addr || !tokenA || !tokenB) continue;
      const inputMint = tokenA === mint ? tokenB : tokenA;
      const outputMint = mint;
      const inputSym = tokenA === mint ? pool.tokenB?.symbol : pool.tokenA?.symbol;
      const outputSym = tokenA === mint ? pool.tokenA?.symbol : pool.tokenB?.symbol;
      const feePct =
        pool.feeRate != null ? `${(Number(pool.feeRate) * 100).toFixed(2)}%` : undefined;
      const tvl = pool.tvlUsdc != null ? Number(pool.tvlUsdc) : undefined;
      const vol = pool.volume24h != null ? Number(pool.volume24h) : undefined;
      markets.push({
        id: `orca-${addr}`,
        venue: 'orca-whirlpool',
        inputMint,
        outputMint,
        label: pairLabel(inputMint, outputMint, inputSym, outputSym),
        feeRate: feePct,
        liquidityUsd: Number.isFinite(tvl) ? tvl : undefined,
        volume24hUsd: Number.isFinite(vol) ? vol : undefined,
        externalUrl: orcaPoolUrl(addr),
      });
    }
  } catch {
    // ignore
  }
  return markets;
}

/** Build Jupiter-route entries from unique counterparty mints in Orca pools + defaults. */
function jupiterRoutesFromPools(orcaMarkets: MarketConfig[]): MarketConfig[] {
  const seen = new Set<string>();
  const routes: MarketConfig[] = [];

  const addRoute = (inputMint: string, label?: string) => {
    if (inputMint === IBO_MINT || seen.has(inputMint)) return;
    seen.add(inputMint);
    routes.push({
      id: `jup-${inputMint.slice(0, 8)}`,
      venue: 'jupiter-route',
      inputMint,
      outputMint: IBO_MINT,
      label: label ?? pairLabel(inputMint, IBO_MINT),
      externalUrl: jupiterSwapUrl(inputMint, IBO_MINT),
    });
  };

  for (const m of orcaMarkets) {
    addRoute(m.inputMint, m.label.replace(' → IBO', '') + ' → IBO');
  }
  addRoute(SOL_MINT);
  addRoute(USDC_MINT);

  return routes;
}

function dedupeMarkets(list: MarketConfig[]): MarketConfig[] {
  const byKey = new Map<string, MarketConfig>();
  for (const m of list) {
    const key = `${m.venue}:${m.inputMint}:${m.outputMint}`;
    const existing = byKey.get(key);
    if (!existing || (m.liquidityUsd ?? 0) > (existing.liquidityUsd ?? 0)) {
      byKey.set(key, m);
    }
  }
  return [...byKey.values()].sort((a, b) => (b.liquidityUsd ?? 0) - (a.liquidityUsd ?? 0));
}

export type MarketsLoadResult = {
  markets: MarketConfig[];
  tokenName?: string;
  tokenSymbol?: string;
  fromLiveApi: boolean;
  error?: string;
};

export async function loadIboMarkets(): Promise<MarketsLoadResult> {
  const meta = await fetchJupiterTokenMeta(IBO_MINT);
  const orca = await fetchOrcaPoolsForMint(IBO_MINT);
  const jupiter = jupiterRoutesFromPools(orca);
  const combined = dedupeMarkets([...orca, ...jupiter]);

  if (combined.length > 0) {
    return {
      markets: combined,
      tokenName: meta?.name,
      tokenSymbol: meta?.symbol ?? 'IBO',
      fromLiveApi: orca.length > 0,
    };
  }

  return {
    markets: [...FALLBACK_MARKETS],
    tokenName: meta?.name,
    tokenSymbol: meta?.symbol ?? 'IBO',
    fromLiveApi: false,
    error: 'Live pool discovery unavailable — showing default routes.',
  };
}
