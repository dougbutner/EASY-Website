export const ASK4INVITE_MESSAGE_MAX = 220;

export function formatAsk4InviteCharCount(length: number): string {
  return `${length}/${ASK4INVITE_MESSAGE_MAX} chars | What's your chess piece look like in the new world of finance, or chair in the EASY Life?`;
}
