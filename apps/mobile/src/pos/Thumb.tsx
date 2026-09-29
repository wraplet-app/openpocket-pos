import { View, Text, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { tileColor, initials } from '../theme';

/**
 * Product image if set, otherwise a colored initials tile.
 * Uses expo-image for memory+disk caching and smooth transitions in lists.
 */
export function Thumb({ uri, name, style, textSize = 22 }: {
  uri: string | null | undefined;
  name: string;
  style: StyleProp<ViewStyle>;
  textSize?: number;
}) {
  if (uri) {
    return (
      <Image
        source={uri}
        style={[style, { backgroundColor: '#e5e7eb' }]}
        contentFit="cover"
        transition={150}
        cachePolicy="memory-disk"
      />
    );
  }
  return (
    <View style={[style, { backgroundColor: tileColor(name), alignItems: 'center', justifyContent: 'center' }]}>
      <Text style={{ color: '#fff', fontWeight: '800', fontSize: textSize }}>{initials(name)}</Text>
    </View>
  );
}
