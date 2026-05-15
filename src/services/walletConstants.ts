import { Chains } from '@wharfkit/common';

export const APP_NAME = 'EASY | New Earth Finance';
/** Served from `public/`; Web SDK `appInfo.logo` needs an absolute URL at runtime. */
export const APP_LOGO_PUBLIC_PATH = '/assets/tokens/easy/EASY.png';
export const REQUEST_ACCOUNT = 'xpr.template';
/** Primary reads and wallet sessions: EOSUSA (Hyperion + chain on same host). Greymass as fallback. */
export const CHAIN_ENDPOINTS = ['https://proton.eosusa.io', 'https://proton.greymass.com'];

/** XPR Network mainnet — same definition WharfKit ships in @wharfkit/common */
export const XPR_CHAIN = Chains.XPR;

export const XPR_CHAIN_ID_HEX = String(XPR_CHAIN.id);
