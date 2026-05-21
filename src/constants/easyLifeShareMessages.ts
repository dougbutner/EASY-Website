import { pickRandomFrom } from '@/constants/tokenAssets';

export const EASY_LIFE_TOOLS_URL = 'https://flex.town';
export const EASY_LIFE_WEBAUTH_URL = 'https://webauth.com';
export const EASY_LIFE_FLEX_REPORT_URL = 'https://flex.report';
export const EASY_LIFE_SHARE_TITLE = 'Check out EASY on Flex Town';

/** Opening lines only — footer links appended by {@link formatEasyLifeShareText}. */
const EASY_LIFE_SHARE_INTROS: readonly string[] = [
  "I believe EASY is a good fit for you and I'm inviting you to check out the tools. If you don't have a wallet, get one at webauth.com and let me know your username so I can send you EASY.",
  "Take it EASY — I think you'd like FLEX on XPR Network. EASY is the flagship flex token (2% reflections to holders). Peek the tools on flex.town; no wallet yet? webauth.com, then send me your username.",
  "Flex tokens on XPR pay you proportional rewards from transfer tax — and with EASY you can flex your daily payout (BTC, SOL, other flex tokens, and more). I'm inviting you to flex.town. Need a wallet first? webauth.com → tell me your account name.",
  "EASY is the first pure-liquid flex token on XPR — fair-launched into pools, rewards in the token you choose. I want you on flex.town with me. If you're not on-chain yet, grab WebAuth and share your username so I can welcome you with EASY.",
  "New Earth Finance vibe: volunteer-built tools, you sign everything yourself. EASY is the core flex token; flex.town has swaps, charts, and the Welcome Program. No wallet? webauth.com — then message me your XPR username.",
  "I'm not here to pressure you — but if EASY sounds interesting, flex.town is the home base and flex.report is the deep dive (tokenomics + contracts). When you have a wallet, tell me your username and I can send EASY your way.",
  "Reflection-style money on XPR: hold EASY (100+ for reflections), pick your reward token on mon3y, or let it compound. I'm sharing flex.town. Still off-chain? Create a wallet at webauth.com and let me know your username.",
  "The Flex family (EASY, WON, GRAMS, MEME) works together — stables, gold, alts, rewards in each other. I think EASY is your best front door. Tools: flex.town. Wallet: webauth.com — ping me your username when ready.",
  "EASY Life welcome on flex.town: 200 EASY seeds someone on XPR (100 to them, 100 to the inbank vault) and grows invite score up-chain. I'd like you in the network — wallet at webauth.com first, then your username so I can welcome you.",
  "Swap once on Alcor, take it EASY — 21M max supply, transfer tax funds holder rewards you can steer. I'm pointing you to flex.town. If you need an account, webauth.com and send me your on-chain name.",
  "flex.report explains the white paper; flex.town is where you actually use EASY (terminal, bridge hooks, welcome flow). I think it's a fit for you. No XPR wallet yet? webauth.com → your username → I can send EASY.",
  "Channel financial energy more efficiently — that's the flex token idea EASY leads on XPR. Check flex.town when you have a minute. Without a wallet, start at webauth.com and tell me your username so I can hook you up.",
  "Infinitely liquid launch story: EASY bought into pools from day one, reflections from real transfer fees not random inflation. Explore on flex.town. New here? webauth.com, then your username so I can send EASY.",
  "Bi-weekly Contributors Club, live charts, Solana bridge tools — flex.town bundles the EASY stack on XPR. I believe you'd get it. Wallet via webauth.com; reply with your username when you want EASY.",
  "Choose beneficiaries and reward tokens on sister flex tokens; EASY keeps it simple with 2% reflection and flex pools on mon3y. I'm inviting you to flex.town. webauth.com if you need a wallet — share your username after.",
  "From the Flex Tokens Liftoff playbook: get a wallet, swap to EASY on Alcor, optionally set your flex reward. I'm skipping the lecture — just try flex.town. webauth.com for a wallet; tell me your username to receive EASY.",
  "Wrapped BTC, GRAMS gold, MEME burns — EASY is the liquid hub tying the ecosystem together on XPR. I want you on flex.town. If you're wallet-less, webauth.com first, then message me your account name for EASY.",
  "Open tools, no bank — volunteers maintain flex.town in the spirit of transparent on-chain finance. EASY might click for you. Create a wallet at webauth.com if needed; send your username when you want me to transfer EASY.",
  "Quick pitch: transfer tax → reward pool → your wallet, daily, in the token you pick. EASY is 2% reflection on XPR. Dive in at flex.town. No wallet? webauth.com — let me know your username and I'll send EASY.",
  "Hey — I stack EASY on XPR (flex rewards, real liquidity backing). flex.town is the toolkit; flex.report if you want the full story. If you don't have WebAuth yet, get one and tell me your username so I can send you EASY.",
] as const;

export function formatEasyLifeShareText(intro: string): string {
  return [
    intro,
    '',
    `Create a wallet: ${EASY_LIFE_WEBAUTH_URL}`,
    `EASY tools: ${EASY_LIFE_TOOLS_URL}`,
  ].join('\n');
}

/** One random invite message per page load (same random pick pattern as the WON logo). */
export function pickRandomEasyLifeShareText(): string {
  return formatEasyLifeShareText(pickRandomFrom(EASY_LIFE_SHARE_INTROS));
}
