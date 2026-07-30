export const ASK4INVITE_MESSAGE_MAX = 220;

export const ASK4INVITE_ACCOUNT_LABEL = 'Account to be welcomed';

export const ASK4INVITE_MESSAGE_LABEL = 'I want to join the EASY Life because';

export const ASK4INVITE_NOMINATION_NOTE =
  'You can nominate another XPR account to receive a welcome - enter their account name above. Your connected wallet signs the request as sponsor.';

/** Glass panel wrapper for ask4invite forms (no backdrop-blur on mobile - avoids foggy overlay bugs). */
export const ask4inviteGlassPanelClass =
  'min-w-0 rounded-2xl border border-yellow-300/20 bg-black/55 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] sm:bg-yellow-200/[0.06] sm:backdrop-blur-xl sm:p-5';

/** Inputs and combobox trigger inside ask4invite glass UI. */
export const ask4inviteGlassFieldClass =
  'rounded-xl border border-yellow-300/25 bg-black/45 text-yellow-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] placeholder:text-yellow-100/35 focus-visible:ring-yellow-300/35 sm:bg-black/30 sm:backdrop-blur-md';

/** Mobile: bottom sheet. Desktop: centered modal. */
export const ask4inviteGlassDialogClass =
  'fixed z-[100] box-border min-w-0 gap-4 overflow-x-hidden overflow-y-auto overscroll-contain border border-yellow-300/20 bg-yellow-950/95 p-4 pb-[max(2rem,env(safe-area-inset-bottom))] text-yellow-50 shadow-[0_-12px_48px_rgba(0,0,0,0.65)] inset-x-0 bottom-0 top-auto max-h-[min(92dvh,100%)] w-full max-w-[100vw] translate-x-0 translate-y-0 rounded-t-3xl data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom sm:inset-auto sm:left-[50%] sm:top-[50%] sm:max-h-[min(92vh,820px)] sm:w-[min(100%-2rem,36rem)] sm:max-w-xl sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-3xl sm:bg-yellow-200/[0.05] sm:p-6 sm:pb-5 sm:shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_25px_80px_rgba(0,0,0,0.55)] sm:backdrop-blur-2xl sm:data-[state=closed]:slide-out-to-left-1/2 sm:data-[state=open]:slide-in-from-left-1/2 sm:data-[state=closed]:slide-out-to-top-[48%] sm:data-[state=open]:slide-in-from-top-[48%]';

export const ask4inviteDialogOverlayClass = 'z-[90] bg-black/70 backdrop-blur-[2px] sm:backdrop-blur-md';

/** Program status right column - solid on mobile to prevent blur stacking. */
export const welcomeStatusPanelClass =
  'rounded-2xl border border-yellow-300/20 bg-black/55 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] sm:bg-yellow-200/[0.04] sm:backdrop-blur-xl';

export const ask4inviteGlassPopoverClass =
  'z-[110] rounded-xl border border-yellow-300/25 bg-yellow-950/98 p-0 text-yellow-50 shadow-[0_12px_40px_rgba(0,0,0,0.55)] sm:bg-black/40 sm:backdrop-blur-xl';

export const ASK4INVITE_CHAR_COUNT_HINT =
  "What's your chess piece look like in the new world of finance, or chair in the EASY Life?";

export function formatAsk4InviteCharCount(length: number): string {
  return `${length}/${ASK4INVITE_MESSAGE_MAX} chars`;
}
