/** Browser-only side effects for exporting: clipboard and file download. */

export async function copyText(text: string): Promise<boolean> {
  const clipboard = globalThis.navigator?.clipboard;
  if (!clipboard?.writeText) return false;

  try {
    await clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Hands the text to the browser as a file download. Returns false where there
 * is no DOM (static rendering), so callers can stay quiet instead of crashing.
 */
export function downloadText(filename: string, text: string, mimeType: string): boolean {
  if (typeof document === 'undefined' || typeof URL.createObjectURL !== 'function') return false;

  const url = URL.createObjectURL(new Blob([text], { type: `${mimeType};charset=utf-8` }));
  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    return true;
  } finally {
    URL.revokeObjectURL(url);
  }
}
