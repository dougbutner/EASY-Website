/**
 * Header — branding and multi-account wallet menu (WebAuth + Anchor).
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
import { walletTypeLabel, type LoadedWallet } from '@/services/walletSessions';
import { Anchor, ChevronDown, Copy, LogIn, Plus, Wallet, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

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
}: HeaderProps) {
  const copyActor = () => {
    if (!actor) return;
    void navigator.clipboard.writeText(actor);
    toast.success('Account name copied');
  };

  return (
    <header className="flex items-center justify-between border-b px-6 py-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
          <span className="text-lg font-bold text-primary-foreground">X</span>
        </div>
        <h1 className="text-xl font-semibold text-foreground">XPR Network multi login template</h1>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {isLoggedIn && actor ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 font-normal">
                <Wallet className="h-4 w-4 text-primary" />
                <span className="max-w-[120px] truncate sm:max-w-[140px]">{actor}</span>
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
                            active
                              ? 'text-accent-foreground/80'
                              : 'text-muted-foreground'
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
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              onClick={() => void onAddWebAuth()}
              disabled={loading}
              size="sm"
              variant="default"
              className="gap-2"
            >
              <LogIn className="h-4 w-4" />
              {loading ? 'Restoring…' : 'WebAuth'}
            </Button>
            <Button
              onClick={() => void onAddAnchor()}
              disabled={loading}
              size="sm"
              variant="outline"
              className="gap-2"
            >
              <Anchor className="h-4 w-4" />
              Anchor
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
