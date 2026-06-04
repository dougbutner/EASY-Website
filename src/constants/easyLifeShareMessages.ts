export const EASY_LIFE_TOOLS_URL = 'https://flex.town';
export const EASY_LIFE_WEBAUTH_URL = 'https://webauth.com';
export const EASY_LIFE_FLEX_REPORT_URL = 'https://flex.report';
export const EASY_LIFE_SHARE_TITLE = 'Check out EASY on Flex Town';

/** Default preloaded invite copy for share buttons (editable in the UI). */
export const EASY_LIFE_SHARE_DEFAULT_INTRO =
  'I was thinking of you when I saw this, I want to welcome you to EASY on the webauth app with your first 100 EASY';

export function formatEasyLifeShareText(intro: string): string {
  return [
    intro,
    '',
    `Create a wallet: ${EASY_LIFE_WEBAUTH_URL}`,
    `EASY tools: ${EASY_LIFE_TOOLS_URL}`,
  ].join('\n');
}

export function defaultEasyLifeShareText(): string {
  return formatEasyLifeShareText(EASY_LIFE_SHARE_DEFAULT_INTRO);
}
