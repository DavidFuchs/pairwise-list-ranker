/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { CardPreview } from '@/components/data/CardPreview';

const SONGS = [
  { title: 'Alien', year: 1979 },
  { title: 'Arrival', year: 2016 },
];

describe('CardPreview', () => {
  it('draws the first item with its title and chosen details', () => {
    render(<CardPreview objects={SONGS} roles={{ labelField: 'title', summaryFields: ['year'] }} />);

    expect(screen.getByText('Alien')).toBeTruthy();
    expect(screen.getByText(/1979/)).toBeTruthy();
  });

  it('leaves out fields that are not on the card', () => {
    render(<CardPreview objects={SONGS} roles={{ labelField: 'title', summaryFields: [] }} />);

    expect(screen.queryByText(/1979/)).toBeNull();
  });

  it('steps through the items, wrapping at either end', async () => {
    const user = userEvent.setup();
    render(<CardPreview objects={SONGS} roles={{ labelField: 'title' }} />);

    await user.click(screen.getByLabelText('Preview the next item'));
    expect(screen.getByText('Arrival')).toBeTruthy();
    expect(screen.getByText('2 of 2')).toBeTruthy();

    await user.click(screen.getByLabelText('Preview the next item'));
    expect(screen.getByText('Alien')).toBeTruthy();

    await user.click(screen.getByLabelText('Preview the previous item'));
    expect(screen.getByText('Arrival')).toBeTruthy();
  });

  it('has no stepper for a single item', () => {
    render(<CardPreview objects={[SONGS[0]!]} roles={{ labelField: 'title' }} />);

    expect(screen.queryByLabelText('Preview the next item')).toBeNull();
  });
});
