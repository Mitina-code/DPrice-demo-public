// The public site's database ships already seeded with the demo projects
// (vendor/runtime/start-db.sqlite.gz, from DPrice-platform's capture flow), so
// the console's in-browser seeding stays off: no account matches DEMO_ACCOUNT.
// This module only keeps the console's imports satisfied.
import { CONFIG } from './demo-config.js?v=202611101340';

export const DEMO_ACCOUNT = '';
export const DEMO_PREFIX = 'demo26-';
export const REGIONS = CONFIG.regions;

export async function seedDemoRegions() {
  return { seeded: [] };
}
