import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function shortenMint(mint: string, head = 6, tail = 4): string {
  if (mint.length <= head + tail + 3) return mint;
  return `${mint.slice(0, head)}…${mint.slice(-tail)}`;
}
