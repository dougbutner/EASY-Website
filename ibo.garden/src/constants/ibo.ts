/** Solana mint for IBO (Iboga Garden token). */
export const IBO_MINT = 'ibozy4AxS6TdsBDerGJN1ZKFFohEubFdHWGcyLxPLFL';

export const SOL_MINT = 'So11111111111111111111111111111111111111112';
export const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

export const SITE_NAME = 'IBO Garden';
export const TOKEN_SYMBOL = 'IBO';
export const TAGLINE = '100% farm-sourced Iboga on Solana';

export const EXPLORER_MINT_URL = `https://solscan.io/token/${IBO_MINT}`;
export const JUPITER_SWAP_URL = `https://jup.ag/swap/SOL-${IBO_MINT}`;
export const ORCA_SWAP_URL = `https://www.orca.so/?tokenIn=${SOL_MINT}&tokenOut=${IBO_MINT}`;

export const navItems = [
  { id: 'hero', label: 'Home' },
  { id: 'source', label: 'Source' },
  { id: 'markets', label: 'Markets' },
  { id: 'swap', label: 'Swap' },
  { id: 'liquidity', label: 'Liquidity' },
  { id: 'token', label: 'Token' },
] as const;

export type NavSectionId = (typeof navItems)[number]['id'];

export const SOURCE_STORY = [
  'IBO Garden is the on-chain home for a token rooted in farm-sourced Iboga — traceable origin, community stewardship, and open markets on Solana.',
  'We keep the story simple: where it comes from, how it trades, and how liquidity grows through Whirlpool and Jupiter routes.',
  'This site is not medical advice. It documents the token, its markets, and tools to swap — nothing more.',
] as const;

export const LIQUIDITY_COPY =
  'Liquidity lives in Orca Whirlpool concentrated pools. Jupiter aggregates routes across those pools and other Solana venues so you can swap into IBO without leaving this page.';

export const DISCLAIMER =
  'Digital assets are experimental and may lose all value. Nothing here is an offer, solicitation, or health guidance. Confirm mint, pool, and amounts on a block explorer before large transactions.';

/** Fallback swap pairs when live discovery is unavailable. */
export const FALLBACK_MARKETS = [
  {
    id: 'fallback-sol-ibo',
    venue: 'jupiter-route' as const,
    inputMint: SOL_MINT,
    outputMint: IBO_MINT,
    label: 'SOL → IBO',
    externalUrl: `https://jup.ag/swap/SOL-${IBO_MINT}`,
  },
  {
    id: 'fallback-usdc-ibo',
    venue: 'jupiter-route' as const,
    inputMint: USDC_MINT,
    outputMint: IBO_MINT,
    label: 'USDC → IBO',
    externalUrl: `https://jup.ag/swap/USDC-${IBO_MINT}`,
  },
];

export const JUPITER_PLUGIN_TARGET_ID = 'ibo-jupiter-plugin-integrated';
