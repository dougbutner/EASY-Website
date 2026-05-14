/**
 * Embeds Jupiter Plugin (Ultra-backed swap UI).
 * Jupiter Terminal (terminal.jup.ag) is deprecated; use Plugin instead — see https://dev.jup.ag/docs/guides/how-to-embed-a-swap-widget
 */
import { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { EASY_SOLANA_MINT } from '@/services/storexBridge';
import { cn } from '@/lib/utils';

const SOL_MINT = 'So11111111111111111111111111111111111111112';
const JUPITER_INTEGRATED_TARGET_ID = 'easy-jupiter-plugin-integrated';
const JUPITER_FALLBACK_SWAP = `https://jup.ag/swap?sell=${SOL_MINT}&buy=${EASY_SOLANA_MINT}`;

async function waitForJupiter(timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (typeof window !== 'undefined' && window.Jupiter?.init) return;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error('Jupiter Plugin did not load in time.');
}

export function JupiterEasyPlugin({ className }: { className?: string }) {
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoadError(null);
      try {
        await waitForJupiter(20000);
        if (cancelled) return;

        window.Jupiter?.close?.();

        window.Jupiter!.init({
          displayMode: 'integrated',
          integratedTargetId: JUPITER_INTEGRATED_TARGET_ID,
          formProps: {
            initialInputMint: SOL_MINT,
            initialOutputMint: EASY_SOLANA_MINT,
          },
        });
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Jupiter Plugin failed to load.');
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
      try {
        window.Jupiter?.close?.();
      } catch {
        // ignore
      }
    };
  }, []);

  return (
    <div className={cn('easy-jupiter-plugin-host flex min-h-[680px] flex-col', className)}>
      <div
        id={JUPITER_INTEGRATED_TARGET_ID}
        className="min-h-[680px] w-full flex-1 overflow-hidden rounded-[inherit]"
      />
      {loadError ? (
        <div className="flex flex-col items-center justify-center gap-3 border-t border-yellow-300/15 bg-black/80 px-4 py-6 text-center text-sm text-yellow-100/80">
          <p>{loadError}</p>
          <a
            href={JUPITER_FALLBACK_SWAP}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-yellow-300/30 px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-yellow-200 hover:bg-yellow-300 hover:text-black"
          >
            Open swap on jup.ag
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      ) : null}
    </div>
  );
}
