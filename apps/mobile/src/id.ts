// ponytail: Math.random UUIDv4 — zero deps, fine for single-device V0.1 row
// ids. Swap for expo-crypto randomUUID when multi-device sync lands (V0.5).
export function newId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// One id per app launch; good enough to tag rows by device for now.
export const DEVICE_ID = newId();
