import { normalizeText } from '@/lib/import/text';

/**
 * A marker is only stripped when whitespace follows it. That single rule is
 * what keeps `-40 below zero` and `1984` intact while still reading every
 * common bullet and numbering style as a list.
 */
const MARKER = /^(?:[-*+•–—>]|\d+[.)]|\(\d+\))\s+/;
const TASK_BOX = /^\[[ xX]\]\s+/;

export function parsePlainList(text: string): string[] {
  return normalizeText(text)
    .split('\n')
    .map((line) => stripMarker(line.trim()))
    .filter((line) => line !== '');
}

function stripMarker(line: string): string {
  const withoutMarker = line.replace(MARKER, '');
  if (withoutMarker === line) return line;
  // `- [x] Alien` is a bullet followed by a task box, not two bullets.
  return withoutMarker.replace(TASK_BOX, '').trim();
}
