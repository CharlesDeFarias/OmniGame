/**
 * App identity shim (decision #49 -> #54): the values now live in the unified
 * profile module (src/config/profile.ts). This re-export keeps existing
 * imports (vite.config.ts PWA manifest, render/main.ts) working unchanged.
 */
import { PROFILE } from './profile';

export const APP_IDENTITY = PROFILE.identity;
