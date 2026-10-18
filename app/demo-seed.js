// The demo build has no server to seed: demo projects come pre-computed from
// ./fixtures/. This module only keeps the console's imports satisfied.
import { CONFIG } from './demo-config.js';

export const DEMO_ACCOUNT = '';
export const DEMO_PREFIX = 'demo26-';
export const REGIONS = CONFIG.regions;

export async function seedDemoRegions() {
  return { seeded: [] };
}
