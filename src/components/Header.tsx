/**
 * Header — EASY brand navigation and multi-account wallet menu (WebAuth + Anchor).
 */
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TOKEN_LOGO } from '@/constants/tokenAssets';
import { walletTypeLabel, type LoadedWallet } from '@/services/walletSessions';
import { Anchor, ChevronDown, Copy, LogIn, Plus, RefreshCw, Wallet, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface HeaderNavItem {
  id: string;
  label: string;
  /** Hide this nav control below `md` (use when the target section is desktop-only). */
  hideBelowMd?: boolean;
}

interface HeaderProps {
  actor: string | null;
  isLoggedIn: boolean;
  loading: boolean;
  wallets: LoadedWallet[];
  activeId: string | null;
  onAddWebAuth: () => Promise<unknown>;
  onAddAnchor: () => Promise<unknown>;
  onSetActive: (id: string) => void;
  onRemoveWallet: (id: string) => Promise<void>;
  onDisconnectAll: () => Promise<void>;
  navItems?: HeaderNavItem[];
  activeSection?: string;
  onNavigate?: (id: string) => void;
  /** Shown beside the Flex Tools nav control; refetches pending reflection pool balances. */
  onRefreshPendingBalance?: () => void;
  pendingBalanceLoading?: boolean;
}

export function Header({
  actor,
  isLoggedIn,
  loading,
  wallets,
  activeId,
  onAddWebAuth,
  onAddAnchor,
  onSetActive,
  onRemoveWallet,
  onDisconnectAll,
  navItems = [],
  activeSection,
  onNavigate,
  onRefreshPendingBalance,
  pendingBalanceLoading = false,
}: HeaderProps) {
  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const activeLink = navRef.current?.querySelector<HTMLButtonElement>(
      `[data-section-id="${activeSection}"]`
    );
    activeLink?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [activeSection]);

  const copyActor = () => {
    if (!actor) return;
    void navigator.clipboard.writeText(actor);
    toast.success('Account name copied');
  };

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-yellow-400/20 bg-black/85 px-4 py-3 shadow-[0_0_40px_rgba(234,179,8,0.12)] backdrop-blur-xl md:px-6">
      <div className="mx-auto flex max-w-7xl items-center gap-3">
        <button
          type="button"
          onClick={() => onNavigate?.('tools')}
          className="flex shrink-0 items-center gap-3 text-left"
        >
          <img
            src={TOKEN_LOGO.EASY}
            alt="EASY"
            width={40}
            height={40}
            className="h-10 w-10 shrink-0 rounded-2xl object-cover shadow-[0_0_30px_rgba(250,204,21,0.35)]"
            decoding="async"
          />
          <div className="hidden sm:block">
            <h1 className="text-lg font-black uppercase tracking-[0.28em] text-yellow-300">EASY</h1>
            <p className="text-[10px] uppercase tracking-[0.22em] text-yellow-100/50">
              New Earth Finance
            </p>
          </div>
        </button>

        {navItems.length > 0 && (
          <nav
            ref={navRef}
            aria-label="Page sections"
            className="mx-1 flex min-w-0 flex-1 items-center gap-2 overflow-x-auto rounded-full border border-yellow-400/15 bg-yellow-400/[0.04] p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {navItems.map((item) => {
              const active = item.id === activeSection;
              const showPendingRefresh = item.id === 'flex-tools' && onRefreshPendingBalance;
              return (
                <div
                  key={item.id}
                  className={cn(
                    'flex shrink-0 items-center gap-0.5',
                    item.hideBelowMd && 'hidden md:flex'
                  )}
                >
                  <button
                    type="button"
                    data-section-id={item.id}
                    onClick={() => onNavigate?.(item.id)}
                    className={cn(
                      'shrink-0 rounded-full px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] transition',
                      active
                        ? 'bg-yellow-300 text-black shadow-[0_0_24px_rgba(250,204,21,0.28)]'
                        : 'text-yellow-100/65 hover:bg-yellow-300/10 hover:text-yellow-200'
                    )}
                  >
                    {item.label}
                  </button>
                  {showPendingRefresh ? (
                    <button
                      type="button"
                      aria-label="Refresh pending reflection pool balance"
                      disabled={pendingBalanceLoading}
                      onClick={() => onRefreshPendingBalance()}
                      className={cn(
                        'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-yellow-400/20 text-yellow-200/80 transition hover:border-yellow-300/40 hover:bg-yellow-300/10 hover:text-yellow-50 disabled:pointer-events-none disabled:opacity-40',
                        pendingBalanceLoading && 'border-yellow-300/35 bg-yellow-300/5'
                      )}
                    >
                      <RefreshCw
                        className={cn('h-3.5 w-3.5', pendingBalanceLoading && 'animate-spin')}
                        aria-hidden
                      />
                    </button>
                  ) : null}
                </div>
              );
            })}
          </nav>
        )}

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {isLoggedIn && actor ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 border-yellow-400/30 bg-black/60 font-normal text-yellow-100 hover:bg-yellow-300 hover:text-black"
                >
                  <Wallet className="h-4 w-4 text-yellow-300" />
                  <span className="max-w-[92px] truncate sm:max-w-[140px]">{actor}</span>
                  <ChevronDown className="h-4 w-4 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <div className="flex items-center gap-2 px-2 py-2">
                  <div className="h-8 w-8 shrink-0 rounded-full bg-primary/20" />
                  <span className="min-w-0 flex-1 truncate font-medium">{actor}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={copyActor}
                    aria-label="Copy account name"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs font-normal uppercase tracking-wide text-muted-foreground">
                  Connected wallets
                </DropdownMenuLabel>
                <ScrollArea className="max-h-64">
                  <div className="pr-2">
                    {wallets.map((w) => {
                      const active = w.id === activeId;
                      return (
                        <DropdownMenuItem
                          key={w.id}
                          className={cn(
                            'flex cursor-pointer items-center gap-2 py-2',
                            active && 'bg-accent text-accent-foreground'
                          )}
                          onSelect={() => onSetActive(w.id)}
                        >
                          <span
                            className={cn(
                              'h-2 w-2 shrink-0 rounded-full',
                              active ? 'bg-primary' : 'bg-muted-foreground/40'
                            )}
                            aria-hidden
                          />
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-medium">
                              {w.provider === 'webauth' ? w.auth.actor : w.actor}
                            </div>
                            <div
                              className={cn(
                                'truncate text-xs',
                                active ? 'text-accent-foreground/75' : 'text-muted-foreground'
                              )}
                            >
                              {walletTypeLabel(w)}
                            </div>
                          </div>
                          <button
                            type="button"
                            className={cn(
                              'flex h-7 w-7 shrink-0 items-center justify-center rounded-md hover:bg-destructive/10 hover:text-destructive',
                              active ? 'text-accent-foreground/80' : 'text-muted-foreground'
                            )}
                            aria-label="Disconnect wallet"
                            onPointerDown={(e) => e.preventDefault()}
                            onClick={() => void onRemoveWallet(w.id)}
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </DropdownMenuItem>
                      );
                    })}
                  </div>
                </ScrollArea>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="gap-2 border border-dashed border-primary/50 text-primary data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
                  onSelect={() => void onAddWebAuth()}
                >
                  <Plus className="h-4 w-4" />
                  Add WebAuth
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="gap-2 border border-dashed border-primary/50 text-primary data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
                  onSelect={() => void onAddAnchor()}
                >
                  <Anchor className="h-4 w-4" />
                  Add Anchor
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="justify-center text-muted-foreground focus:text-destructive"
                  onSelect={() => void onDisconnectAll()}
                >
                  Disconnect all
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex items-center justify-end gap-2">
              <Button
                onClick={() => void onAddWebAuth()}
                disabled={loading}
                size="sm"
                variant="default"
                className="gap-2 bg-yellow-300 text-black hover:bg-yellow-200"
              >
                <LogIn className="h-4 w-4" />
                <span className="hidden sm:inline">{loading ? 'Restoring...' : 'WebAuth'}</span>
              </Button>
              <Button
                onClick={() => void onAddAnchor()}
                disabled={loading}
                size="sm"
                variant="outline"
                className="gap-2 border-yellow-400/30 bg-black/60 text-yellow-100 hover:bg-yellow-300 hover:text-black"
              >
                <Anchor className="h-4 w-4" />
                <span className="hidden sm:inline">Anchor</span>
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
