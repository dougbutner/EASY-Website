import { IBO_MINT, JUPITER_PLUGIN_TARGET_ID } from '@/constants/ibo';
import { cn } from '@/lib/utils';
import { ExternalLink } from 'lucide-react';
import { useEffect, useState } from 'react';

async function waitForJupiter(timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (typeof window !== 'undefined' && window.Jupiter?.init) return;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error('Jupiter Plugin did not load in time.');
}

type JupiterIboSwapProps = {
  inputMint: string;
  className?: string;
};

export function JupiterIboSwap({ inputMint, className }: JupiterIboSwapProps) {
  const [loadError, setLoadError] = useState<string | null>(null);
  const fallbackUrl = `https://jup.ag/swap/${inputMint}-${IBO_MINT}`;

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
          integratedTargetId: JUPITER_PLUGIN_TARGET_ID,
          formProps: {
            initialInputMint: inputMint,
            initialOutputMint: IBO_MINT,
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
  }, [inputMint]);

  return (
    <div className={cn('ibo-jupiter-plugin-host flex min-h-[680px] flex-col', className)}>
      <div
        id={JUPITER_PLUGIN_TARGET_ID}
        className="min-h-[680px] w-full flex-1 overflow-hidden rounded-[inherit]"
      />
      {loadError ? (
        <div className="flex flex-col items-center justify-center gap-3 border-t border-garden-moss/20 bg-black/80 px-4 py-6 text-center text-sm text-stone-300">
          <p>{loadError}</p>
          <a
            href={fallbackUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-garden-moss/40 px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-garden-moss hover:bg-garden-moss hover:text-[#050806]"
          >
            Open swap on jup.ag
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      ) : null}
    </div>
  );
}
