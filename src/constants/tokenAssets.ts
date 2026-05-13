/** Static token art under `public/assets/tokens/` (served at `/assets/tokens/...`). */

export const TOKEN_LOGO = {
  EASY: '/assets/tokens/easy/EASY.png',
  MEME: '/assets/tokens/meme/meme.png',
  GRAMS: '/assets/tokens/grams/grams-512.png',
} as const;

const WON_DIR = '/assets/tokens/won';

/** All WON art variants — one is chosen at random on each full page load. */
export const WON_VARIANT_URLS: readonly string[] = [
  `${WON_DIR}/won.png`,
  `${WON_DIR}/won-blue-enlightened-planet.png`,
  `${WON_DIR}/won-blue-zebra-planet.png`,
  `${WON_DIR}/won-disco.png`,
  `${WON_DIR}/won-earth-fancy-space.png`,
  `${WON_DIR}/won-earth-plain.png`,
  `${WON_DIR}/won-earth-splash.png`,
  `${WON_DIR}/won-earth-swag-purple.png`,
  `${WON_DIR}/won-enlightened-world.png`,
  `${WON_DIR}/won-fol-blue.png`,
  `${WON_DIR}/won-fol-starseed-uncolored.png`,
  `${WON_DIR}/won-fol-starseed.png`,
  `${WON_DIR}/won-holy-fucking-natural-human-progression-towards-enlightenment-gudasol.png`,
  `${WON_DIR}/won-infinite-purple.png`,
  `${WON_DIR}/won-influence-on-spacetime-blue.png`,
  `${WON_DIR}/won-lightburst-plexus-tile.png`,
  `${WON_DIR}/won-lightburst.png`,
  `${WON_DIR}/won-more-pure-enlightenment.png`,
  `${WON_DIR}/won-natural-human-progression-towards-enlightenment-gudasol.png`,
  `${WON_DIR}/won-pink-swag.png`,
  `${WON_DIR}/won-pink-wtf.png`,
  `${WON_DIR}/won-plexus-orion-burst.png`,
  `${WON_DIR}/won-plexus-uniburst-blue.png`,
  `${WON_DIR}/won-plexus-uniburst-red.png`,
  `${WON_DIR}/won-plexus-uniburst.png`,
  `${WON_DIR}/won-pure-enlightenment.png`,
  `${WON_DIR}/won-sacred-burst-yellow.png`,
  `${WON_DIR}/won-sacred-splash.png`,
  `${WON_DIR}/won-sdf-stars.png`,
  `${WON_DIR}/won-starseed-burst.png`,
  `${WON_DIR}/won-starseed-deep=space.png`,
  `${WON_DIR}/won-swag-clouds-sdf.png`,
  `${WON_DIR}/won-swag.png`,
  `${WON_DIR}/won-tile-lightburst.png`,
  `${WON_DIR}/won-yaing-blue.png`,
];

export function pickRandomWonVariant(): string {
  const i = Math.floor(Math.random() * WON_VARIANT_URLS.length);
  return WON_VARIANT_URLS[i] ?? `${WON_DIR}/won.png`;
}
