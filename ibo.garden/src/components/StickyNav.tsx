import { navItems, SITE_NAME, type NavSectionId } from '@/constants/ibo';
import { cn } from '@/lib/utils';
import { Leaf } from 'lucide-react';
import { useEffect, useRef } from 'react';

type StickyNavProps = {
  activeSection: NavSectionId;
  onNavigate: (id: NavSectionId) => void;
};

export function StickyNav({ activeSection, onNavigate }: StickyNavProps) {
  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const activeLink = navRef.current?.querySelector<HTMLButtonElement>(
      `[data-section-id="${activeSection}"]`
    );
    activeLink?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [activeSection]);

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-garden-moss/30 bg-[#050806]/90 px-4 py-3 shadow-[0_0_32px_rgba(45,106,79,0.15)] backdrop-blur-xl md:px-6">
      <div className="mx-auto flex max-w-6xl items-center gap-3">
        <button
          type="button"
          onClick={() => onNavigate('hero')}
          className="flex shrink-0 items-center gap-2 text-left"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-garden-green/40 text-garden-amber shadow-[0_0_24px_rgba(64,145,108,0.35)]">
            <Leaf className="h-5 w-5" aria-hidden />
          </span>
          <div className="hidden sm:block">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-garden-moss">{SITE_NAME}</p>
            <p className="text-[10px] uppercase tracking-[0.18em] text-stone-400">Solana</p>
          </div>
        </button>

        <nav
          ref={navRef}
          aria-label="Page sections"
          className="mx-1 flex min-w-0 flex-1 items-center gap-1 overflow-x-auto rounded-full border border-garden-moss/20 bg-garden-green/[0.06] p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {navItems.map((item) => {
            const active = item.id === activeSection;
            return (
              <button
                key={item.id}
                type="button"
                data-section-id={item.id}
                onClick={() => onNavigate(item.id)}
                className={cn(
                  'shrink-0 rounded-full px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] transition sm:px-4',
                  active
                    ? 'bg-garden-moss text-[#050806] shadow-[0_0_20px_rgba(64,145,108,0.4)]'
                    : 'text-stone-300 hover:bg-garden-green/20 hover:text-stone-100'
                )}
              >
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
