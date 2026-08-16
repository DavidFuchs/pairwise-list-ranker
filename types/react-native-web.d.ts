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
  }
  interface TextInputProps {
    dataSet?: Record<string, string | number | boolean | undefined>;
  }
}
