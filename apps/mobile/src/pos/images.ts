import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { newId } from '../id';

const DIR = FileSystem.documentDirectory + 'products/';

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
async function persist(asset: ImagePicker.ImagePickerAsset): Promise<string> {
  await FileSystem.makeDirectoryAsync(DIR, { intermediates: true }).catch(() => {});
  const ext = (asset.mimeType && EXT[asset.mimeType]) ?? 'jpg';
  const dest = `${DIR}${newId()}.${ext}`;
  await FileSystem.copyAsync({ from: asset.uri, to: dest });
  return dest;
}

export async function pickFromGallery(): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6, allowsEditing: true, aspect: [1, 1] });
  if (res.canceled || !res.assets?.[0]) return null;
  return persist(res.assets[0]);
}

export async function takePhoto(): Promise<string | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) return null;
  const res = await ImagePicker.launchCameraAsync({ quality: 0.6, allowsEditing: true, aspect: [1, 1] });
  if (res.canceled || !res.assets?.[0]) return null;
  return persist(res.assets[0]);
}
