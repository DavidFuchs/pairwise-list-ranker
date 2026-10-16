import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { FieldImage } from '@/components/preview/FieldImage';
import { pictureUrl, youtubeId } from '@/lib/renderers';
import type { FieldRenderer } from '@/types/source';

export interface FieldPictureProps {
  value: unknown;
  renderer: FieldRenderer | undefined;
  size: number;
  label: string;
  /** A video thumbnail opens its video. Off where the picture sits on a drag handle. */
  linked?: boolean;
}

/**
 * The picture beside an item: an image field, or a YouTube video's thumbnail.
 * A thumbnail is a way into its video, so it opens it in a new tab - without
 * also choosing the card it sits on.
 */
export function FieldPicture({ value, renderer, size, label, linked = true }: FieldPictureProps) {
  const image = <FieldImage value={pictureUrl(value, renderer)} size={size} label={label} />;
  const id = renderer === 'youtube' ? youtubeId(value) : undefined;
  if (id === undefined || !linked) return image;

  const video = `https://www.youtube.com/watch?v=${id}`;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`Watch ${label} on YouTube`}
      href={video}
      hrefAttrs={{ target: '_blank', rel: 'noopener noreferrer' }}
      onPress={(event) => {
        event.stopPropagation();
        if (Platform.OS !== 'web') void Linking.openURL(video);
      }}
    >
      {image}
      <View style={styles.play} pointerEvents="none">
        <Text style={[styles.glyph, { fontSize: Math.max(9, size / 7) }]}>▶</Text>
      </View>
    </Pressable>
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
