import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { pickRandomWonVariant, TOKEN_LOGO } from '@/constants/tokenAssets';
import { cn } from '@/lib/utils';
import {
  FLEX_CHEST_TOKENS,
  fetchFlexChestBalances,
  formatChestDisplay,
  type FlexChestBalances,
} from '@/services/flexChest';
import {
  EASY_INVITE_MIN_AMOUNT,
  EASY_REWELCOME_MEMO,
  WELCOME_BACK_DOWNSTREAM_DEPTH,
  countUniqueDownstreamFromAdopters,
  fetchAllEasyInviteAdopters,
  fetchEasyInviteAccountStatus,
  tetrahedralLevelFromScore,
  welcomeBackMinimumEasy,
  type EasyInviteAccountStatus,
} from '@/services/easyInvite';
import { formatFlexAssetPretty } from '@/services/flexFlexerBalance';

export type InviteQueueRequestDetail = {
  account: string;
  requester: string;
  message: string;
  /** Preloaded from `adopters` table when opening from the network graph. */
  score?: number;
  banked?: string;
  /** When set, skips a second full-table read for downstream count. */
  downstreamCount?: number;
};

const EASY_INVITE_DEFAULT_MEMO = 'Welcome to the EASY Life 🍹';
const EASY_INVITE_ACCOUNT_RE = /^[a-z1-5.]{1,12}$/;

type InviteQueueRequestDialogProps = {
  detail: InviteQueueRequestDetail | null;
  onClose: () => void;
  isLoggedIn: boolean;
  submitting: string | null;
  onWelcome: (params: { account: string; amount: number; memo: string }) => void;
  onWelcomeBack?: (params: { account: string; amount: number; memo: string }) => void;
};

export function truncateInviteMessage(message: string, maxLen = 20): string {
  const trimmed = message.trim();
  if (!trimmed) return '__';
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, maxLen)}…`;
}

export function InviteQueueRequestDialog({
  detail,
  onClose,
  isLoggedIn,
  submitting,
  onWelcome,
  onWelcomeBack,
}: InviteQueueRequestDialogProps) {
  const [welcomeAmount, setWelcomeAmount] = useState(String(EASY_INVITE_MIN_AMOUNT));
  const [welcomeMemo, setWelcomeMemo] = useState(EASY_INVITE_DEFAULT_MEMO);
  const [accountStatus, setAccountStatus] = useState<EasyInviteAccountStatus | null>(null);
  const [accountChecking, setAccountChecking] = useState(false);
  const [chestBalances, setChestBalances] = useState<FlexChestBalances | null>(null);
  const [chestLoading, setChestLoading] = useState(false);
  const [downstreamCount, setDownstreamCount] = useState<number | null>(null);
  const [downstreamLoading, setDownstreamLoading] = useState(false);
  const wonLogoUrl = useMemo(() => pickRandomWonVariant(), []);

  const inviteScore = detail?.score ?? 0;
  const tetraLevel = tetrahedralLevelFromScore(inviteScore);
  const welcomeBackMin =
    inviteScore > 0 || detail?.score !== undefined ? welcomeBackMinimumEasy(inviteScore) : EASY_INVITE_MIN_AMOUNT;

  useEffect(() => {
    if (!detail) {
      setAccountStatus(null);
      setChestBalances(null);
      setDownstreamCount(null);
      return;
    }

    const account = detail.account.trim().toLowerCase();
    const requestMessage = detail.message.trim();
    setWelcomeMemo(requestMessage || EASY_INVITE_DEFAULT_MEMO);
    setWelcomeAmount(String(EASY_INVITE_MIN_AMOUNT));

    let cancelled = false;
    setAccountChecking(true);
    setChestLoading(true);

    void fetchEasyInviteAccountStatus(account)
      .then((status) => {
        if (!cancelled) {
          setAccountStatus(status);
          if (status.registered) {
            const score = detail.score ?? inviteScore;
            setWelcomeAmount(String(welcomeBackMinimumEasy(score)));
            setWelcomeMemo(EASY_REWELCOME_MEMO);
          }
        }
      })
      .catch(() => {
        if (!cancelled) setAccountStatus(null);
      })
      .finally(() => {
        if (!cancelled) setAccountChecking(false);
      });

    void fetchFlexChestBalances(account)
      .then((balances) => {
        if (!cancelled) setChestBalances(balances);
      })
      .catch(() => {
        if (!cancelled) setChestBalances(null);
      })
      .finally(() => {
        if (!cancelled) setChestLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [detail]);

  useEffect(() => {
    if (!detail) {
      setDownstreamCount(null);
      setDownstreamLoading(false);
      return;
    }

    const account = detail.account.trim().toLowerCase();
    if (detail.downstreamCount !== undefined) {
      setDownstreamCount(detail.downstreamCount);
      setDownstreamLoading(false);
      return;
    }

    let cancelled = false;
    setDownstreamLoading(true);
    void fetchAllEasyInviteAdopters()
      .then((adopters) => {
        if (!cancelled) {
          setDownstreamCount(countUniqueDownstreamFromAdopters(account, adopters));
        }
      })
      .catch(() => {
        if (!cancelled) setDownstreamCount(null);
      })
      .finally(() => {
        if (!cancelled) setDownstreamLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [detail]);

  const handleWelcome = () => {
    if (!detail) return;
    const account = detail.account.trim().toLowerCase();
    const amount = Number(welcomeAmount);
    if (!Number.isFinite(amount) || amount < EASY_INVITE_MIN_AMOUNT) return;
    onWelcome({ account, amount, memo: welcomeMemo.trim() || EASY_INVITE_DEFAULT_MEMO });
  };

  const handleWelcomeBack = () => {
    if (!detail || !onWelcomeBack) return;
    const account = detail.account.trim().toLowerCase();
    const amount = Number(welcomeAmount);
    if (!Number.isFinite(amount) || amount < welcomeBackMin) return;
    onWelcomeBack({ account, amount, memo: welcomeMemo.trim() || EASY_REWELCOME_MEMO });
  };

  const account = detail?.account.trim().toLowerCase() ?? '';
  const isRegistered = accountStatus?.account === account && accountStatus.registered;
  const canWelcome =
    isLoggedIn &&
    submitting === null &&
    !accountChecking &&
    EASY_INVITE_ACCOUNT_RE.test(account) &&
    accountStatus?.account === account &&
    accountStatus.exists &&
    !accountStatus.registered;
  const canWelcomeBack =
    isLoggedIn &&
    submitting === null &&
    !accountChecking &&
    Boolean(onWelcomeBack) &&
    EASY_INVITE_ACCOUNT_RE.test(account) &&
    isRegistered;

  return (
    <Dialog open={detail !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        overlayClassName="bg-black/70 backdrop-blur-md"
        className="max-w-lg gap-5 border-yellow-300/20 bg-black/95 text-yellow-50 shadow-2xl sm:max-w-xl sm:rounded-2xl"
      >
        <DialogHeader className="text-left">
          <DialogTitle className="text-xl font-black text-yellow-50">
            {detail?.account ?? 'Invite request'}
          </DialogTitle>
          {detail?.requester ? (
            <p className="text-sm text-yellow-100/55">
              Invited by <span className="font-mono text-yellow-200/90">{detail.requester}</span>
            </p>
          ) : null}
        </DialogHeader>

        {detail ? (
          <div className="grid gap-4">
            {detail.message.trim() ? (
              <div className="space-y-1">
                <Label className="text-yellow-100/80">Their request message</Label>
                <p className="whitespace-pre-wrap rounded-md border border-yellow-300/20 bg-black/70 px-3 py-2 text-sm leading-relaxed text-yellow-100/85">
                  {detail.message.trim()}
                </p>
              </div>
            ) : null}

            {(detail.score !== undefined || detail.banked) && (
              <div className="grid gap-2 rounded-md border border-yellow-300/15 bg-yellow-300/[0.04] px-3 py-2 text-sm sm:grid-cols-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-yellow-300/70">
                    Invite score
                  </p>
                  <p className="font-mono text-yellow-50">{detail.score ?? 0}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-yellow-300/70">
                    Tetrahedral level
                  </p>
                  <p className="font-mono text-yellow-50">{tetraLevel}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-yellow-300/70">
                    Banked EASY
                  </p>
                  <p className="font-mono text-xs text-yellow-100/85">
                    {detail.banked ? formatFlexAssetPretty(detail.banked) : '—'}
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-yellow-100/80">Flex chest</Label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {FLEX_CHEST_TOKENS.map(({ symbol }) => {
                  const logo =
                    symbol === 'EASY'
                      ? TOKEN_LOGO.EASY
                      : symbol === 'WON'
                        ? wonLogoUrl
                        : symbol === 'GRAMS'
                          ? TOKEN_LOGO.GRAMS
                          : TOKEN_LOGO.MEME;
                  const display = chestLoading
                    ? '…'
                    : formatChestDisplay(symbol, chestBalances?.[symbol] ?? null);
                  return (
                    <div
                      key={symbol}
                      className="flex flex-col items-center gap-1.5 rounded-lg border border-yellow-300/15 bg-black/60 px-2 py-2.5 text-center"
                    >
                      <img src={logo} alt="" className="h-8 w-8 rounded-lg object-cover" />
                      <span className="text-[10px] font-black uppercase tracking-wider text-yellow-300/80">
                        {symbol}
                      </span>
                      <span className="font-mono text-[11px] leading-tight text-yellow-100/85">{display}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <p className="min-h-5 text-xs text-yellow-100/50">
              {accountChecking
                ? 'Checking account…'
                : accountStatus?.account === account
                  ? accountStatus.exists
                    ? accountStatus.registered
                      ? 'Already in the Welcome Program — Welcome Back captures their downstream.'
                      : 'Account exists and can be welcomed.'
                    : 'Account does not exist on XPR Network yet.'
                  : 'Account check pending…'}
            </p>

            {isRegistered ? (
              <div className="space-y-2 rounded-md border border-yellow-300/25 bg-yellow-300/[0.07] px-3 py-3">
                <p className="text-sm font-semibold leading-relaxed text-yellow-50">
                  Welcome Back captures their downstream
                </p>
                <p className="text-sm leading-relaxed text-yellow-100/70">
                  You become their upstream on-chain. We count{' '}
                  <span className="font-semibold text-yellow-200">unique</span> accounts they welcomed, up to{' '}
                  <span className="font-semibold text-yellow-200">{WELCOME_BACK_DOWNSTREAM_DEPTH} levels</span> deep
                  (each account once, even if Welcome Back formed a loop).
                </p>
                <p className="font-mono text-base font-bold text-yellow-200">
                  {downstreamLoading
                    ? 'Counting downstream…'
                    : downstreamCount !== null
                      ? `Capture the downstream of ${downstreamCount} account${downstreamCount === 1 ? '' : 's'} for ${welcomeBackMin} EASY`
                      : `Capture their downstream for ${welcomeBackMin} EASY`}
                </p>
                <p className="text-xs text-yellow-100/45">
                  {welcomeBackMin} EASY = 200 × tetrahedral level {tetraLevel} (from their invite score of{' '}
                  {inviteScore}).
                </p>
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-[0.55fr_1fr]">
              <div className="space-y-2">
                <Label htmlFor="queue-welcome-amount" className="text-yellow-100/80">
                  {isRegistered ? 'EASY Welcome Back' : 'EASY Welcome Package'}
                </Label>
                <Input
                  id="queue-welcome-amount"
                  value={welcomeAmount}
                  onChange={(event) => setWelcomeAmount(event.target.value)}
                  inputMode="decimal"
                  className="border-yellow-300/20 bg-black/70 text-yellow-50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="queue-welcome-memo" className="text-yellow-100/80">
                  Message to them
                </Label>
                <Input
                  id="queue-welcome-memo"
                  value={welcomeMemo}
                  onChange={(event) => setWelcomeMemo(event.target.value)}
                  className="border-yellow-300/20 bg-black/70 text-yellow-50"
                />
              </div>
            </div>

            {isRegistered ? (
              <Button
                type="button"
                onClick={handleWelcomeBack}
                disabled={!canWelcomeBack || submitting === 'Welcome Back'}
                className={cn(
                  'w-full bg-yellow-300 text-black hover:bg-yellow-200',
                  (!canWelcomeBack || submitting === 'Welcome Back') && 'opacity-40'
                )}
              >
                {submitting === 'Welcome Back' ? 'Opening transaction…' : 'Welcome Back'}
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleWelcome}
                disabled={!canWelcome || submitting === 'Welcome program'}
                className={cn(
                  'w-full bg-yellow-300 text-black hover:bg-yellow-200',
                  (!canWelcome || submitting === 'Welcome program') && 'opacity-40'
                )}
              >
                {submitting === 'Welcome program' ? 'Opening transaction…' : 'Welcome to the EASY Life'}
              </Button>
            )}
            <p className="text-xs leading-relaxed text-yellow-100/45">
              {isRegistered ? (
                <>
                  Send at least {welcomeBackMin} EASY to{' '}
                  <code className="rounded bg-yellow-300/10 px-1">invite.mon3y</code>, memo{' '}
                  <code className="rounded bg-yellow-300/10 px-1">account|{EASY_REWELCOME_MEMO}</code>.
                </>
              ) : (
                <>
                  Send at least {EASY_INVITE_MIN_AMOUNT} EASY to{' '}
                  <code className="rounded bg-yellow-300/10 px-1">invite.mon3y</code>, memo{' '}
                  <code className="rounded bg-yellow-300/10 px-1">account|message</code>.
                </>
              )}
            </p>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
