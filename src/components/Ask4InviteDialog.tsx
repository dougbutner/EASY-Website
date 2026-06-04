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
import { ASK4INVITE_MESSAGE_MAX, formatAsk4InviteCharCount } from '@/constants/ask4inviteUi';
import { cn } from '@/lib/utils';

const EASY_INVITE_ACCOUNT_RE = /^[a-z1-5.]{1,12}$/;
const codeInlineClass = 'rounded bg-yellow-300/10 px-1 py-0.5 text-[0.9em] text-yellow-200';

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
  onSubmit,
}: Ask4InviteDialogProps) {
  const [account, setAccount] = useState('');
  const [message, setMessage] = useState('');
  const [nationIso3, setNationIso3] = useState('');
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTurnstileToken(isTurnstileConfigured() ? null : 'bypass');
    if (actor) setAccount(actor);
  }, [open, actor]);

  const requestText = message.trim() || 'Requesting welcome via flex.town';
  const turnstileReady = !isTurnstileConfigured() || Boolean(turnstileToken);
  const canSubmit =
    isLoggedIn &&
    Boolean(actor) &&
    !inProgram &&
    !programLoading &&
    submitting === null &&
    nationIso3.length > 0 &&
    EASY_INVITE_ACCOUNT_RE.test(account.trim().toLowerCase()) &&
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
        overlayClassName="bg-black/70 backdrop-blur-md"
        className="max-h-[min(92vh,820px)] max-w-lg gap-5 overflow-y-auto border-yellow-300/20 bg-black/95 text-yellow-50 shadow-2xl sm:max-w-xl sm:rounded-2xl"
      >
        <DialogHeader className="text-left">
          <DialogTitle className="text-xl font-black text-yellow-50">Request a welcome</DialogTitle>
          <p className="text-sm font-black uppercase tracking-[0.18em] text-yellow-300">Join the invite queue</p>
        </DialogHeader>

        <p className="text-sm leading-7 text-yellow-100/65">
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

        <div className="grid gap-3">
          <div className="space-y-2">
            <Label htmlFor="ask4invite-account" className="text-yellow-100/80">
              My account
            </Label>
            <Input
              id="ask4invite-account"
              value={account}
              onChange={(event) => setAccount(event.target.value.toLowerCase())}
              placeholder="accountname"
              className="border-yellow-300/20 bg-black/70 font-mono text-yellow-50"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ask4invite-message" className="text-yellow-100/80">
              I want to join the EASY Life because
            </Label>
            <textarea
              id="ask4invite-message"
              value={message}
              onChange={(event) => {
                const next = event.target.value;
                setMessage(next.length > ASK4INVITE_MESSAGE_MAX ? next.slice(0, ASK4INVITE_MESSAGE_MAX) : next);
              }}
              className="min-h-[96px] w-full resize-y rounded-md border border-yellow-300/20 bg-black/70 px-3 py-2 text-sm text-yellow-50 placeholder:text-yellow-100/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300/40"
            />
            <p className="text-xs text-yellow-100/45">{formatAsk4InviteCharCount(message.length)}</p>
          </div>

          <TurnstileWidget onToken={setTurnstileToken} className="flex justify-center" />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <InviteNationSelect
                id="ask4invite-nation"
                value={nationIso3}
                onValueChange={setNationIso3}
              />
            </div>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className={cn(
                'w-full shrink-0 bg-yellow-300 text-black hover:bg-yellow-200 sm:w-auto sm:min-w-[11rem]',
                !canSubmit && 'opacity-40'
              )}
            >
              {submitting === 'Request a welcome' ? 'Submitting…' : 'Request a welcome'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
