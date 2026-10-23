import { useEffect, useState } from 'react';

import { requestApplePreview } from '@/lib/preview/applePreview';
import { isExpired, requestDeezerPreview } from '@/lib/preview/deezerPreview';
import { togglePreview } from '@/lib/preview/playback';
import type { PreviewProvider, PreviewSource } from '@/lib/renderers';

/** A clip that was found, and the source it came from. */
export interface FoundPreview {
  /** The source as one string, which is also what playback is keyed by. */
  key: string;
  source: PreviewSource;
  url: string;
}

export const sourceKey = (source: PreviewSource) => `${source.provider}:${source.id}`;

const LOOKUPS: Record<PreviewProvider, (id: string, onResolved: (url: string | null) => void) => () => void> =
  {
    apple: requestApplePreview,
    deezer: requestDeezerPreview,
  };

function parseKey(key: string): PreviewSource {
  const at = key.indexOf(':');
  return { provider: key.slice(0, at) as PreviewProvider, id: key.slice(at + 1) };
}

/**
 * The first source with a clip, trying them in order: undefined while still
 * looking, null once every one has none. A later source is only asked once
 * the one before it has come up empty, so the button never starts on one
 * catalogue and then switches to another.
 */
export function usePreviewSources(sources: PreviewSource[]): FoundPreview | null | undefined {
  // One string, so a fresh array of the same sources is not a new request.
  const signature = sources.map(sourceKey).join('|');
  const [answer, setAnswer] = useState<{ signature: string; found: FoundPreview | null } | null>(null);

  useEffect(() => {
    const keys = signature === '' ? [] : signature.split('|');
    let cancel: () => void = () => undefined;
    let stopped = false;
    const tryFrom = (index: number) => {
      if (stopped) return;
      if (index >= keys.length) {
        setAnswer({ signature, found: null });
        return;
      }
      const source = parseKey(keys[index]!);
      cancel = LOOKUPS[source.provider](source.id, (url) => {
        if (url === null) tryFrom(index + 1);
        else if (!stopped) setAnswer({ signature, found: { key: keys[index]!, source, url } });
      });
    };
    tryFrom(0);
    return () => {
      stopped = true;
      cancel();
    };
  }, [signature]);

  if (sources.length === 0) return null;
  return answer?.signature === signature ? answer.found : undefined;
}

/** Plays or stops a found clip, first fetching a fresh address for one that has lapsed. */
export function togglePreviewOf(found: FoundPreview): void {
  if (found.source.provider === 'deezer' && isExpired(found.url)) {
    requestDeezerPreview(found.source.id, (url) => {
      if (url !== null) togglePreview(found.key, url);
    });
    return;
  }
  togglePreview(found.key, found.url);
}
