/**
 * Personal-layer app identity (decision #49): Luana's install is branded
 * "Luana Studio". The public/generic layer swaps this one file to rebrand
 * (name, install shortname, chrome color) without touching anything else.
 */
export const APP_IDENTITY = { name: 'Luana Studio', shortName: 'Luana', themeColor: '#141428' } as const;
