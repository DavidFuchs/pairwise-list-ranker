import 'react-native';

/**
 * react-native-web accepts a `dataSet` prop and renders it as `data-*`
 * attributes. It is the supported way to reach CSS features that React Native
 * styles cannot express — gradients, hover, and focus rings live in
 * `lib/themeCss.ts` and hook onto these attributes.
 */
declare module 'react-native' {
  interface ViewProps {
    dataSet?: Record<string, string | number | boolean | undefined>;
  }
  interface TextProps {
    dataSet?: Record<string, string | number | boolean | undefined>;
  }
  interface PressableProps {
    dataSet?: Record<string, string | number | boolean | undefined>;
    /**
     * react-native-web forwards these to the DOM node. Dragging the ranked list
     * and moving a row from the keyboard both need them, and React Native's own
     * types stop at touch gestures.
     */
    onKeyDown?: (event: import('react').KeyboardEvent<HTMLElement>) => void;
    onPointerDown?: (event: {
      preventDefault: () => void;
      nativeEvent: { clientY: number; pointerId: number };
    }) => void;
  }
  interface TextInputProps {
    dataSet?: Record<string, string | number | boolean | undefined>;
  }
}
