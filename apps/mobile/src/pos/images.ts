import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { newId } from '../id';

const DIR = FileSystem.documentDirectory + 'products/';
const BRAND_DIR = FileSystem.documentDirectory + 'branding/';

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/gif': 'gif',
};

// Picker results live in a cache the OS can purge — copy into the app's
// document directory so the product image survives restarts. The extension is
// derived from the asset's mimeType (URIs are often extension-less content://).
async function persist(asset: ImagePicker.ImagePickerAsset, dir: string = DIR): Promise<string> {
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
  const ext = (asset.mimeType && EXT[asset.mimeType]) ?? 'jpg';
  const dest = `${dir}${newId()}.${ext}`;
  await FileSystem.copyAsync({ from: asset.uri, to: dest });
  return dest;
}

// Product photos keep the whole image the user picked (no forced square crop) —
// the UI shows them with resizeMode="contain" so nothing is cut off.
export async function pickFromGallery(): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
  if (res.canceled || !res.assets?.[0]) return null;
  return persist(res.assets[0]);
}

export async function takePhoto(): Promise<string | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) return null;
  const res = await ImagePicker.launchCameraAsync({ quality: 0.7 });
  if (res.canceled || !res.assets?.[0]) return null;
  return persist(res.assets[0]);
}

/** Pick a shop logo from the gallery (square crop, kept in the app's branding folder). */
export async function pickLogo(): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, allowsEditing: true, aspect: [1, 1] });
  if (res.canceled || !res.assets?.[0]) return null;
  return persist(res.assets[0], BRAND_DIR);
}
