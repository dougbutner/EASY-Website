import type { MarketConfig } from '@/services/markets';
import { cn } from '@/lib/utils';
import { ExternalLink, Waves } from 'lucide-react';

type MarketGridProps = {
  markets: MarketConfig[];
  selectedId: string | null;
  onSelect: (market: MarketConfig) => void;
  loading?: boolean;
  statusMessage?: string;
};

function formatUsd(n?: number): string | null {
  if (n == null || !Number.isFinite(n)) return null;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

export function MarketGrid({
  markets,
  selectedId,
  onSelect,
  loading,
  statusMessage,
}: MarketGridProps) {
  if (loading) {
    return (
      <p className="text-center text-sm text-stone-400">Loading Orca Whirlpool and Jupiter routes…</p>
    );
  }

  return (
    <div className="w-full max-w-6xl space-y-4">
      {statusMessage ? (
        <p className="text-center text-sm text-garden-amber/90">{statusMessage}</p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {markets.map((m) => {
          const selected = m.id === selectedId;
          const tvl = formatUsd(m.liquidityUsd);
          const vol = formatUsd(m.volume24hUsd);
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onSelect(m)}
              className={cn(
                'glass-panel flex flex-col p-5 text-left transition',
                selected
                  ? 'border-garden-amber/50 ring-2 ring-garden-moss/40'
                  : 'hover:border-garden-moss/40'
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                    m.venue === 'orca-whirlpool'
                      ? 'bg-garden-green/30 text-garden-moss'
                      : 'bg-garden-amber/20 text-garden-amber'
                  )}
                >
                  {m.venue === 'orca-whirlpool' ? 'Whirlpool' : 'Jupiter'}
                </span>
                <a
                  href={m.externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-stone-500 hover:text-garden-moss"
                  aria-label={`Open ${m.label} externally`}
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
              <p className="mt-4 text-lg font-black text-stone-50">{m.label}</p>
              <div className="mt-3 flex flex-wrap gap-3 text-xs text-stone-400">
                {m.feeRate ? <span>Fee {m.feeRate}</span> : null}
                {tvl ? <span>TVL {tvl}</span> : null}
                {vol ? <span>24h {vol}</span> : null}
              </div>
              {selected ? (
                <p className="mt-4 flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-garden-moss">
                  <Waves className="h-3.5 w-3.5" />
                  Active in swap
                </p>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
