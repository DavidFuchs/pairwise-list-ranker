import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

import { themeBootScript, themeCss } from '@/lib/themeCss';

/**
 * The HTML shell for the static export. Theme tokens live here as CSS custom
 * properties so light and dark are resolved by the stylesheet, not by React:
 * the markup is identical in both modes, which keeps static rendering and
 * hydration in agreement.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <meta name="color-scheme" content="light dark" />
        {/* Named before the app runs; each screen then sets its own title. */}
        <title>Pairwise</title>
        <meta
          name="description"
          content="Rank any list by comparing two items at a time. Runs entirely in your browser."
        />

        <ScrollViewStyleReset />

        <style dangerouslySetInnerHTML={{ __html: themeCss }} />
        {/* Applies the saved theme before first paint, so there is no flash. */}
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
