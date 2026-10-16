import type { ReactElement } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { FieldImage } from '@/components/preview/FieldImage';
import type { Picture } from '@/lib/renderers';

export interface FieldPictureProps {
  /** Absent for an item with nothing to picture: it keeps an empty frame. */
  picture: Picture | undefined;
  size: number;
  label: string;
  /** A picture that leads somewhere opens it. Off where the picture sits on a drag handle. */
  linked?: boolean;
}

/**
 * One picture beside an item: an image, a video's thumbnail, a store banner.
 * A picture that is a way into something - a video, a store page - opens it
 * in a new tab, without also choosing the card it sits on.
 */
export function FieldPicture({ picture, size, label, linked = true }: FieldPictureProps) {
  const image = <FieldImage value={picture?.uri} size={size} aspect={picture?.aspect} label={label} />;
  const href = picture?.href;
  if (href === undefined || !linked) return withVideoMark(image, picture?.video === true, size);

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={(picture?.action ?? 'Open {label}').replace('{label}', label)}
      href={href}
      hrefAttrs={{ target: '_blank', rel: 'noopener noreferrer' }}
      onPress={(event) => {
        event.stopPropagation();
        if (Platform.OS !== 'web') void Linking.openURL(href);
      }}
    >
      {withVideoMark(image, picture?.video === true, size)}
    </Pressable>
  );
}

function withVideoMark(image: ReactElement, video: boolean, size: number) {
  if (!video) return image;
  return (
    <View>
      {image}
      <View style={styles.play} pointerEvents="none">
        <Text style={[styles.glyph, { fontSize: Math.max(9, size / 7) }]}>▶</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // A small mark in the corner, so the picture reads as a video without hiding it.
  play: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    paddingVertical: 1,
    paddingHorizontal: 5,
    borderRadius: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  glyph: { color: '#FFFFFF' },
});
