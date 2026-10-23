/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ObjectDrilldown } from '@/components/comparison/ObjectDrilldown';

describe('ObjectDrilldown', () => {
  it('shows each remaining field as a key and value', () => {
    render(<ObjectDrilldown value={{ title: 'Arrival', year: 2016 }} omitField="title" />);

    expect(screen.getByText('year')).toBeDefined();
    expect(screen.getByText('2016')).toBeDefined();
  });

  it('leaves out the field already used as the label', () => {
    render(<ObjectDrilldown value={{ title: 'Arrival', year: 2016 }} omitField="title" />);

    expect(screen.queryByText('title')).toBeNull();
  });

  it('renders a nested object as readable text', () => {
    render(<ObjectDrilldown value={{ crew: { director: 'Villeneuve' } }} />);

    expect(screen.getByText(/director: Villeneuve/)).toBeDefined();
  });

  it('renders a list of values as bullet-free lines', () => {
    render(<ObjectDrilldown value={{ cast: ['Amy Adams', 'Jeremy Renner'] }} />);

    expect(screen.getByText(/Amy Adams/)).toBeDefined();
    expect(screen.getByText(/Jeremy Renner/)).toBeDefined();
  });

  it('shows an empty value as an explicit placeholder', () => {
    render(<ObjectDrilldown value={{ tagline: '' }} />);

    expect(screen.getByText(/empty/i)).toBeDefined();
  });

  it('shows a null value without crashing', () => {
    render(<ObjectDrilldown value={{ sequel: null }} />);

    expect(screen.getByText(/none/i)).toBeDefined();
  });

  it('says so when nothing remains to show', () => {
    render(<ObjectDrilldown value={{ title: 'Arrival' }} omitField="title" />);

    expect(screen.getByText(/no other fields/i)).toBeDefined();
  });
});
