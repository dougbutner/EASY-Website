import { Chains } from '@wharfkit/common';

export const APP_NAME = 'XPR Network multi login template';
export const REQUEST_ACCOUNT = 'xpr.template';
export const CHAIN_ENDPOINTS = ['https://proton.greymass.com'];

/** XPR Network mainnet — same definition WharfKit ships in @wharfkit/common */
export const XPR_CHAIN = Chains.XPR;

export const XPR_CHAIN_ID_HEX = String(XPR_CHAIN.id);
