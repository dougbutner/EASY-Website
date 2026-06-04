import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { InviteNationSelect } from '@/components/InviteNationSelect';
import { TurnstileWidget, isTurnstileConfigured } from '@/components/TurnstileWidget';
import {
  ASK4INVITE_ACCOUNT_LABEL,
  ASK4INVITE_CHAR_COUNT_HINT,
  ASK4INVITE_MESSAGE_LABEL,
  ASK4INVITE_MESSAGE_MAX,
  ASK4INVITE_NOMINATION_NOTE,
  ask4inviteDialogOverlayClass,
  ask4inviteGlassDialogClass,
  ask4inviteGlassFieldClass,
  ask4inviteGlassPanelClass,
  formatAsk4InviteCharCount,
} from '@/constants/ask4inviteUi';
import { cn } from '@/lib/utils';

const EASY_INVITE_ACCOUNT_RE = /^[a-z1-5.]{1,12}$/;
const codeInlineClass =
  'whitespace-normal break-words rounded bg-yellow-300/10 px-1 py-0.5 text-[0.9em] text-yellow-200';

export type Ask4InviteSubmitPayload = {
  account: string;
  requester: string;
  request: string;
  nationIso3: string;
};

type Ask4InviteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actor: string | null;
  isLoggedIn: boolean;
  inProgram: boolean;
  programLoading: boolean;
  submitting: string | null;
  /** When true, account field starts empty for sponsoring another account. */
  nominateSomeone?: boolean;
  onSubmit: (payload: Ask4InviteSubmitPayload) => void;
};

export function Ask4InviteDialog({
  open,
  onOpenChange,
  actor,
  isLoggedIn,
  inProgram,
  programLoading,
  submitting,
  nominateSomeone = false,
  onSubmit,
}: Ask4InviteDialogProps) {
  const [account, setAccount] = useState('');
  const [message, setMessage] = useState('');
  const [nationIso3, setNationIso3] = useState('');
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTurnstileToken(isTurnstileConfigured() ? null : 'bypass');
    if (nominateSomeone) {
      setAccount('');
    } else if (actor) {
      setAccount(actor);
    }
  }, [open, actor, nominateSomeone]);

  const accountNorm = account.trim().toLowerCase();
  const requestText = message.trim() || 'Requesting welcome via flex.town';
  const turnstileReady = !isTurnstileConfigured() || Boolean(turnstileToken);
  const selfRequestWhileInProgram = inProgram && Boolean(actor) && accountNorm === actor;
  const canSubmit =
    isLoggedIn &&
    Boolean(actor) &&
    !selfRequestWhileInProgram &&
    !programLoading &&
    submitting === null &&
    nationIso3.length > 0 &&
    EASY_INVITE_ACCOUNT_RE.test(accountNorm) &&
    requestText.length > 0 &&
    requestText.length <= ASK4INVITE_MESSAGE_MAX &&
    turnstileReady;

  const handleSubmit = () => {
    if (!actor || !canSubmit) return;
    onSubmit({
      account: account.trim().toLowerCase(),
      requester: actor,
      request: requestText,
      nationIso3,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName={ask4inviteDialogOverlayClass}
        className={ask4inviteGlassDialogClass}
      >
        <DialogHeader className="min-w-0 text-left">
          <DialogTitle className="text-lg font-black text-yellow-50 sm:text-xl">
            {nominateSomeone || (inProgram && accountNorm !== actor) ? 'Nominate someone' : 'Request a welcome'}
          </DialogTitle>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-yellow-300 sm:text-sm sm:tracking-[0.18em]">
            Join the invite queue
          </p>
        </DialogHeader>

        <p className="min-w-0 break-words rounded-2xl border border-yellow-300/15 bg-black/35 px-3 py-3 text-sm leading-relaxed text-yellow-100/65 sm:px-4 sm:leading-7 sm:bg-black/20 sm:backdrop-blur-md">
          Submits <code className={codeInlineClass}>invite.mon3y::ask4invite</code> on-chain. A generous soul can later
          welcome you with a 200 EASY transfer to <code className={codeInlineClass}>invite.mon3y</code>, memo prefix{' '}
          <code className={codeInlineClass}>*|</code>
          Welcome or <code className={codeInlineClass}>MEX|Bienvenidos</code> or{' '}
          <code className={codeInlineClass}>urname|Welcome</code>.{' '}
          <a
            href="https://t.me/flextokens"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-yellow-200 underline decoration-yellow-300/35 underline-offset-2 hover:text-yellow-50"
          >
            Tell us why in Telegram
          </a>
        </p>

        <div className={cn('grid gap-4', ask4inviteGlassPanelClass)}>
          <div className="space-y-2">
            <Label htmlFor="ask4invite-account" className="text-yellow-100/80">
              {ASK4INVITE_ACCOUNT_LABEL}
            </Label>
            <Input
              id="ask4invite-account"
              value={account}
              onChange={(event) => setAccount(event.target.value.toLowerCase())}
              placeholder="accountname"
              className={cn('font-mono', ask4inviteGlassFieldClass)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ask4invite-message" className="text-yellow-100/80">
              {ASK4INVITE_MESSAGE_LABEL}
            </Label>
            <textarea
              id="ask4invite-message"
              value={message}
              onChange={(event) => {
                const next = event.target.value;
                setMessage(next.length > ASK4INVITE_MESSAGE_MAX ? next.slice(0, ASK4INVITE_MESSAGE_MAX) : next);
              }}
              className={cn(
                'min-h-[96px] w-full resize-y px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2',
                ask4inviteGlassFieldClass
              )}
            />
            <p className="min-w-0 break-words text-xs leading-relaxed text-yellow-100/45">
              <span className="font-medium text-yellow-100/55">
                {formatAsk4InviteCharCount(message.length)}
              </span>
              <span aria-hidden className="mx-1 hidden sm:inline">
                |
              </span>
              <span className="mt-0.5 block sm:mt-0 sm:inline">{ASK4INVITE_CHAR_COUNT_HINT}</span>
            </p>
          </div>

          <TurnstileWidget onToken={setTurnstileToken} className="flex min-w-0 justify-center overflow-hidden" />

          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <InviteNationSelect
                id="ask4invite-nation"
                value={nationIso3}
                onValueChange={setNationIso3}
                triggerClassName={ask4inviteGlassFieldClass}
              />
            </div>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className={cn(
                'w-full shrink-0 rounded-xl bg-yellow-300 text-black hover:bg-yellow-200 sm:w-auto sm:min-w-0 sm:flex-1 sm:basis-40',
                !canSubmit && 'opacity-40'
              )}
            >
              {submitting === 'Request a welcome' ? 'Submitting…' : 'Request a welcome'}
            </Button>
          </div>

          <p className="min-w-0 break-words text-xs leading-relaxed text-yellow-100/50">
            {ASK4INVITE_NOMINATION_NOTE}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
