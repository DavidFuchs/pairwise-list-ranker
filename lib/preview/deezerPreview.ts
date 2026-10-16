import { Platform } from 'react-native';

/**
 * Deezer's public API answers without a key, but sends no CORS headers, so a
 * browser can only read it as JSONP: a script tag whose response calls back
 * into the page. Elsewhere a plain fetch works.
 */
export type DeezerTransport = (url: string) => Promise<unknown>;

const JSONP_TIMEOUT_MS = 10_000;
let callbackCount = 0;

function jsonp(url: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const name = `__deezerPreview${++callbackCount}`;
    const script = document.createElement('script');
    const scope = window as unknown as Record<string, unknown>;
    const cleanUp = () => {
      clearTimeout(timer);
      delete scope[name];
      script.remove();
    };
    const timer = setTimeout(() => {
      cleanUp();
      reject(new Error('Deezer did not answer'));
    }, JSONP_TIMEOUT_MS);
    scope[name] = (body: unknown) => {
      cleanUp();
      resolve(body);
    };
    script.onerror = () => {
      cleanUp();
      reject(new Error('Deezer could not be reached'));
    };
    script.src = `${url}?output=jsonp&callback=${name}`;
    document.head.appendChild(script);
  });
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Deezer answered ${response.status}`);
  return response.json();
}

let transport: DeezerTransport = Platform.OS === 'web' ? jsonp : fetchJson;

/** Swaps how Deezer is reached. For tests, which have no network to load a script from. */
export function setDeezerTransport(next: DeezerTransport): void {
  transport = next;
  resolved.clear();
}

/** id -> clip address, or null once Deezer has said there is none. */
const resolved = new Map<string, string | null>();
const waiting = new Map<string, ((url: string | null) => void)[]>();

/**
 * Deezer signs each clip address to stop working about a quarter of an hour
 * after it is handed out (exp=, in seconds). One about to lapse is looked up
 * again rather than played.
 */
const EXPIRY_MARGIN_S = 60;

export function isExpired(url: string, now = Date.now()): boolean {
  // Written inside the signature: ?hdnea=exp=1792178401~acl=...
  const match = /[?~&=]exp=(\d+)/.exec(url);
  return match !== null && Number(match[1]) - EXPIRY_MARGIN_S <= now / 1000;
}

function cached(id: string): string | null | undefined {
  const url = resolved.get(id);
  if (typeof url === 'string' && isExpired(url)) {
    resolved.delete(id);
    return undefined;
  }
  return url;
}

async function lookup(id: string): Promise<string | null> {
  try {
    const body = (await transport(`https://api.deezer.com/track/${id}`)) as { preview?: unknown } | null;
    return typeof body?.preview === 'string' && body.preview !== '' ? body.preview : null;
  } catch {
    // A failed lookup just means no play button from Deezer.
    return null;
  }
}

/** Deezer has no batch lookup, so each track is one request, shared by everything asking for it. */
export function requestDeezerPreview(id: string, onResolved: (url: string | null) => void): () => void {
  const known = cached(id);
  if (known !== undefined) {
    onResolved(known);
    return () => undefined;
  }
  const callbacks = waiting.get(id);
  if (callbacks === undefined) {
    waiting.set(id, [onResolved]);
    void lookup(id).then((url) => {
      resolved.set(id, url);
      const listeners = waiting.get(id) ?? [];
      waiting.delete(id);
      for (const callback of listeners) callback(url);
    });
  } else {
    callbacks.push(onResolved);
  }
  return () => {
    const current = waiting.get(id);
    if (current !== undefined) waiting.set(id, current.filter((callback) => callback !== onResolved));
  };
}
