import type { Migration } from '../runner.ts';

/**
 * Shop profile + receipt customisation, all on the stores row so it syncs and
 * backs up with everything else. `address` and `phone` already existed on
 * stores (0000) but the app never wrote them.
 *
 * Receipt columns are nullable on purpose: a row synced from an older device
 * carries NULL for them, and the app treats NULL as "use the default".
 *
 * logo_uri is a path to a file in the app's document directory, so it is
 * device-local and deliberately NOT part of the synced column list (same
 * reason a second device must not overwrite its own logo with a foreign path).
 */
const sql = /* sql */ `
ALTER TABLE stores ADD COLUMN logo_uri TEXT;
ALTER TABLE stores ADD COLUMN email TEXT;
ALTER TABLE stores ADD COLUMN website TEXT;
ALTER TABLE stores ADD COLUMN tax_id TEXT;
ALTER TABLE stores ADD COLUMN tagline TEXT;
ALTER TABLE stores ADD COLUMN receipt_footer TEXT;
ALTER TABLE stores ADD COLUMN receipt_terms TEXT;
ALTER TABLE stores ADD COLUMN receipt_accent TEXT;
ALTER TABLE stores ADD COLUMN receipt_paper TEXT DEFAULT 'a4';
ALTER TABLE stores ADD COLUMN receipt_show_logo INTEGER DEFAULT 1;
ALTER TABLE stores ADD COLUMN receipt_show_contact INTEGER DEFAULT 1;
ALTER TABLE stores ADD COLUMN receipt_show_staff INTEGER DEFAULT 1;
`;

export const migration: Migration = { id: '0006_store_profile', sql };
