/**
 * @vitest-environment jsdom
 *
 * Guards the test harness itself: React Native primitives must render through
 * react-native-web, and accessibility props must reach the DOM, or every
 * component test below is meaningless.
 */
import { render, screen } from '@testing-library/react';
import { Pressable, Text } from 'react-native';
import { describe, expect, it, vi } from 'vitest';

describe('react-native-web test harness', () => {
  it('renders React Native primitives as DOM nodes', () => {
    render(<Text>Hello</Text>);

    expect(screen.getByText('Hello')).toBeDefined();
  });

  it('exposes accessibility roles and labels to queries', () => {
    render(
      <Pressable accessibilityRole="button" accessibilityLabel="Choose left">
        <Text>Left</Text>
      </Pressable>,
    );

    expect(screen.getByRole('button', { name: 'Choose left' })).toBeDefined();
  });

  it('delivers press events', async () => {
    const onPress = vi.fn();
    const { default: userEvent } = await import('@testing-library/user-event');
    render(
      <Pressable accessibilityRole="button" accessibilityLabel="Tap" onPress={onPress}>
        <Text>Tap</Text>
      </Pressable>,
    );

    await userEvent.setup().click(screen.getByRole('button', { name: 'Tap' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
