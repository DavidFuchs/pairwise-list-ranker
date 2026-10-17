/** @vitest-environment jsdom */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import DataScreen from '@/app/index';
import { listStore } from '@/lib/state/useListStore';

vi.mock('expo-router', () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }) }));

const png = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52,
]);

/** Through the file input, past its type filter, as a drop would arrive. */
async function chooseFile(file: File) {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  await userEvent.setup({ applyAccept: false }).upload(input, file);
}

function editor(): HTMLTextAreaElement {
  return screen.getByRole('textbox', { name: 'Your list' }) as HTMLTextAreaElement;
}

describe('opening a file on the setup screen', () => {
  beforeEach(() => {
    listStore.getState().reset();
    globalThis.localStorage?.clear();
  });

  it('offers only text, YAML and JSON files in the picker', () => {
    render(<DataScreen />);

    const accept = (document.querySelector('input[type="file"]') as HTMLInputElement).accept;
    expect(accept).toContain('.yaml');
    expect(accept).toContain('.json');
    expect(accept).not.toContain('image');
  });

  it('refuses a picture rather than reading it as a list', async () => {
    render(<DataScreen />);
    await userEvent.setup().type(editor(), 'Alien');

    await chooseFile(new File([png], 'photo.png', { type: 'image/png' }));

    expect(await screen.findByText(/"photo.png" is not a text file/)).toBeDefined();
    expect(editor().value).toBe('Alien');
  });

  it('fills an empty box straight away', async () => {
    render(<DataScreen />);

    await chooseFile(new File(['Alien\nArrival\n'], 'films.txt', { type: 'text/plain' }));

    await waitFor(() => expect(editor().value).toBe('Alien\nArrival\n'));
  });

  it('asks before replacing text already in the box, and keeps it if told to', async () => {
    const user = userEvent.setup();
    render(<DataScreen />);
    await user.type(editor(), 'Solaris');

    await chooseFile(new File(['Alien\nArrival\n'], 'films.txt', { type: 'text/plain' }));

    expect(await screen.findByText(/Replace the text in the box with "films.txt"\?/)).toBeDefined();
    expect(editor().value).toBe('Solaris');
    await user.click(screen.getByRole('button', { name: 'Keep current' }));
    expect(editor().value).toBe('Solaris');
  });

  it('replaces the text once confirmed', async () => {
    const user = userEvent.setup();
    render(<DataScreen />);
    await user.type(editor(), 'Solaris');

    await chooseFile(new File(['Alien\nArrival\n'], 'films.txt', { type: 'text/plain' }));
    await user.click(await screen.findByRole('button', { name: 'Replace the text with films.txt' }));

    expect(editor().value).toBe('Alien\nArrival\n');
  });
});
