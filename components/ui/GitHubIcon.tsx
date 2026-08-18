import { StyleSheet, View } from 'react-native';
import type { ViewStyle } from 'react-native';

import { colors } from '@/lib/theme';

export interface GitHubIconProps {
  /**
   * Defaults to `--github-ink`, a variable the surrounding control sets: see
   * the `[data-github]` rules in themeCss, which turn the mark the accent
   * colour once it is hovered or focused.
   */
  color?: string;
}

const MARK_PATH =
  'M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z';

const MARK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="${MARK_PATH}"/></svg>`;

// Masked rather than drawn from primitives (unlike TrashIcon/SampleIcon):
// the octocat's curves aren't feasible from borders and boxes, and the
// project has no SVG-in-JS dependency. A CSS mask keeps it themeable through
// the same `var(--*-ink)` hover convention as the other header icons.
const MARK_MASK = `url("data:image/svg+xml,${encodeURIComponent(MARK_SVG)}")`;

export function GitHubIcon({ color = `var(--github-ink, ${colors.textFaint})` }: GitHubIconProps) {
  return (
    <View
      style={[
        styles.icon,
        { backgroundColor: color, maskImage: MARK_MASK } as ViewStyle,
      ]}
    />
  );
}

const SIZE = 18;

const styles = StyleSheet.create({
  icon: {
    width: SIZE,
    height: SIZE,
    maskRepeat: 'no-repeat',
    maskPosition: 'center',
    maskSize: 'contain',
  } as ViewStyle,
});
