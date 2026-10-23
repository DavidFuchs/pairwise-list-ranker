/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { copyText, downloadText } from '@/lib/browser/exportActions';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('copyText', () => {
  it('writes the text to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    await expect(copyText('hello')).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('hello');
  });

  it('reports failure when the browser denies clipboard access', async () => {
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    });

    await expect(copyText('hello')).resolves.toBe(false);
  });

  it('reports failure when there is no clipboard at all', async () => {
    vi.stubGlobal('navigator', {});

    await expect(copyText('hello')).resolves.toBe(false);
  });
});

describe('downloadText', () => {
  it('downloads the text under the given filename', () => {
    const createObjectURL = vi.fn().mockReturnValue('blob:fake');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    const result = downloadText('dinners.yaml', 'version: 1\n', 'application/yaml');

    expect(result).toBe(true);
    expect(createObjectURL).toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
  });

  it('releases the object URL afterwards', () => {
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn().mockReturnValue('blob:fake'),
      revokeObjectURL,
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    downloadText('dinners.yaml', 'version: 1\n', 'application/yaml');

    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake');
  });

  it('leaves no stray anchor in the document', () => {
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn().mockReturnValue('blob:fake'),
      revokeObjectURL: vi.fn(),
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    downloadText('dinners.yaml', 'version: 1\n', 'application/yaml');

    expect(document.querySelectorAll('a')).toHaveLength(0);
  });
});
