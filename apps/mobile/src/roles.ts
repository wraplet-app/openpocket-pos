/**
 * Roles, capabilities and PIN hashing — pure, no SQL, no React. Tested by
 * roles.test via the pos-core node runner is overkill; the self-check at the
 * bottom runs under `node --test src/roles.ts` if ever needed.
 */

export type Role = 'owner' | 'manager' | 'cashier';

export const ROLES: Role[] = ['owner', 'manager', 'cashier'];

export const ROLE_LABEL: Record<Role, string> = {
  owner: 'Owner',
  manager: 'Manager',
  cashier: 'Cashier',
};

const RANK: Record<Role, number> = { cashier: 0, manager: 1, owner: 2 };

/** Things a role may or may not do. Selling is always allowed for everyone. */
export type Capability =
  | 'reports' | 'products' | 'returns' | 'purchases' | 'suppliers' | 'customers' | 'backup' | 'staff' | 'sync';

// Minimum rank required per capability. Cashier=0, Manager=1, Owner=2.
const MIN_RANK: Record<Capability, number> = {
  reports: 1, products: 1, returns: 1, purchases: 1, suppliers: 1, customers: 1, backup: 1,
  staff: 2, // only owners manage staff
  sync: 2,  // only owners connect the store to the cloud
};

export function can(role: Role, cap: Capability): boolean {
  return RANK[role] >= MIN_RANK[cap];
}

/**
 * PIN hashing. A 4-digit PIN has only 10k combinations, so no hash is
 * brute-force resistant here — the point is to avoid storing the PIN in
 * plaintext and to salt it per-row so identical PINs don't collide visibly.
 * ponytail: cyrb53 (non-crypto). Move to expo-crypto/argon2 only if a PIN ever
 * guards remote or high-value data.
 */
function cyrb53(str: string, seed = 0): string {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}

export function randomSalt(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function hashPin(pin: string, salt: string): string {
  return cyrb53(`${salt}:${pin}`);
}

export function verifyPin(pin: string, salt: string, hash: string): boolean {
  return hashPin(pin, salt) === hash;
}

export function isValidPin(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}
