import * as FileSystem from 'expo-file-system/legacy';
import { newId } from '../id';

const DIR = FileSystem.documentDirectory + 'products/';

export interface BarcodeInfo { name?: string; imageUrl?: string }

/**
 * Look a barcode up in the free Open Food Facts database (no API key). Returns
 * a product name and image URL when found. Network-only; callers must handle
 * null (offline, unknown barcode, or a made-up code).
 */
export async function lookupBarcode(barcode: string): Promise<BarcodeInfo | null> {
  const code = barcode.trim();
  if (!/^\d{8,14}$/.test(code)) return null;
  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=product_name,brands,image_front_url,image_url`,
      { headers: { 'User-Agent': 'OpenPocketPOS/1.0 (offline POS)' } },
    );
    if (!res.ok) return null;
    const json: any = await res.json();
    if (json.status !== 1 || !json.product) return null;
    const p = json.product;
    const brand = typeof p.brands === 'string' ? p.brands.split(',')[0]?.trim() : '';
    const title = typeof p.product_name === 'string' ? p.product_name.trim() : '';
    const name = [brand, title].filter(Boolean).join(' ') || undefined;
    const imageUrl = p.image_front_url || p.image_url || undefined;
    if (!name && !imageUrl) return null;
    return { name, imageUrl };
  } catch {
    return null;
  }
}

/** Download a remote image into the app's product folder so it works offline. */
export async function downloadProductImage(url: string): Promise<string | null> {
  try {
    await FileSystem.makeDirectoryAsync(DIR, { intermediates: true }).catch(() => {});
    const base = url.split('?')[0] ?? url;
    const ext = base.split('.').pop()?.toLowerCase();
    const safe = ext && ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? ext : 'jpg';
    const dest = `${DIR}${newId()}.${safe}`;
    const r = await FileSystem.downloadAsync(url, dest);
    return r.uri;
  } catch {
    return null;
  }
}
