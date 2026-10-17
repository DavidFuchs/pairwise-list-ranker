let cached: boolean | undefined;

/**
 * Whether this browser draws flag emoji as flags. Chrome and Edge on Windows
 * have no flag glyphs and fall back to the two letters, drawn in the text
 * colour; a real flag has colour of its own, which is what this looks for.
 * Anywhere it cannot look - no canvas, no DOM - it assumes flags draw, so a
 * note about them only appears where it is known to apply.
 */
export function drawsFlags(): boolean {
  if (cached === undefined) cached = detect();
  return cached;
}

function detect(): boolean {
  if (typeof document === 'undefined' || typeof navigator === 'undefined') return true;
  if (/jsdom/i.test(navigator.userAgent)) return true;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (context === null) return true;
    context.textBaseline = 'top';
    context.font = '24px sans-serif';
    context.fillStyle = '#000';
    context.fillText('\u{1F1FA}\u{1F1F8}', 0, 0);
    const pixels = context.getImageData(0, 0, 32, 32).data;
    for (let index = 0; index < pixels.length; index += 4) {
      const [red, green, blue, alpha] = [
        pixels[index]!,
        pixels[index + 1]!,
        pixels[index + 2]!,
        pixels[index + 3]!,
      ];
      if (alpha > 0 && (red !== green || green !== blue)) return true;
    }
    return false;
  } catch {
    return true;
  }
}
