import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ProgressLine } from '@/components/comparison/ProgressLine';
import { Modal } from '@/components/ui/Modal';
import type { ProgressDisplay } from '@/lib/state/progress';
import {
  MAX_CIRCLE_PICTURE,
  type AnswerRef,
  type ProgressExplanation,
  type Spot,
} from '@/lib/state/progressExplain';
import { colors, fonts, radius, space, typeScale } from '@/lib/theme';

export interface ProgressExplainerModalProps {
  visible: boolean;
  onClose: () => void;
  progress: ProgressDisplay;
  /** Null while there is nothing to read it from, as while the list restores. */
  explanation: ProgressExplanation | null;
  labelOf: (id: string) => string;
}

/** Uncompared items named before the rest are only counted. */
const MAX_UNCOMPARED_NAMED = 8;

/**
 * Why the progress line reads what it does (docs/ARCHITECTURE.md 6.12): a
 * paragraph for the stage it is at, the spots still in doubt in terms of the
 * user's own answers, and what settles each. The words describe the answers,
 * never the person: a circle is three fair answers about close items, not a
 * change of mind.
 */
export function ProgressExplainerModal({
  visible,
  onClose,
  progress,
  explanation,
  labelOf,
}: ProgressExplainerModalProps) {
  return (
    <Modal visible={visible} onClose={onClose} title="How close is this order?">
      <ProgressLine progress={progress} />
      {explanation !== null && <Explanation explanation={explanation} labelOf={labelOf} />}
    </Modal>
  );
}

function Explanation({
  explanation,
  labelOf,
}: {
  explanation: ProgressExplanation;
  labelOf: (id: string) => string;
}) {
  const { state, level, spots, moreSpots } = explanation;

  if (state.kind === 'comparing') {
    const named = explanation.uncompared.slice(0, MAX_UNCOMPARED_NAMED).map(labelOf);
    const rest = explanation.uncompared.length - named.length;
    return (
      <>
        <Text style={styles.body}>
          {
            "Pairwise can't say how close the order is until every item has been compared at least once. These haven't been yet:"
          }
        </Text>
        <Text style={styles.body}>
          {rest > 0 ? `${named.join(', ')} and ${rest} more.` : `${joinNames(named)}.`}
        </Text>
        <Text style={styles.body}>Keep answering to bring them in.</Text>
      </>
    );
  }

  const opening =
    state.kind === 'ranked-start'
      ? "Your list started in an order you said was already ranked, so Pairwise trusts that order and can't measure how far off it is. What it can show is where your answers disagree with it."
      : level === 0
        ? `Many items could still move several places.${
            explanation.doubtful > 0
              ? ` ${plural(explanation.doubtful, 'more pair')} ${explanation.doubtful === 1 ? 'is' : 'are'} still in doubt.`
              : ''
          }`
        : level === 1
          ? 'Most of the order is settled. A few spots are still in doubt:'
          : level === 2
            ? 'Only fine adjustments left. The last doubts:'
            : spots.length > 0
              ? 'Nothing is left in real doubt. The likeliest remaining change:'
              : 'Nothing is left in real doubt.';

  return (
    <>
      <Text style={styles.body}>{opening}</Text>
      {state.kind === 'ranked-start' && spots.length === 0 && (
        <Text style={styles.body}>{'None of your answers disagree with the starting order so far.'}</Text>
      )}
      {spots.map((spot, index) => (
        <SpotCard key={index} spot={spot} labelOf={labelOf} />
      ))}
      {moreSpots > 0 && (
        <Text style={styles.body}>{`And ${plural(moreSpots, 'more spot')} like these.`}</Text>
      )}
      {level === 3 ? (
        <Text style={styles.body}>You can stop here, or keep going to be sure.</Text>
      ) : (
        <Settled explanation={explanation} labelOf={labelOf} />
      )}
    </>
  );
}

function Settled({
  explanation,
  labelOf,
}: {
  explanation: ProgressExplanation;
  labelOf: (id: string) => string;
}) {
  const { settled } = explanation;
  if (settled === null || explanation.spots.length === 0) return null;
  if ('count' in settled) {
    return <Text style={styles.body}>{`The other ${settled.count} items are settled.`}</Text>;
  }
  const parts = [
    settled.first.length > 0 && `${joinNames(settled.first.map(labelOf))} first`,
    settled.middle.length > 0 && `${joinNames(settled.middle.map(labelOf))} in the middle`,
    settled.last.length > 0 && `${joinNames(settled.last.map(labelOf))} last`,
  ].filter((part): part is string => part !== false);
  return (
    <Text
      style={styles.body}
    >{`Everything else is settled: ${parts.join(', ')}, from answers that all agree.`}</Text>
  );
}

/** "a", "a and b", "a, b and c". */
function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1) as string}`;
}

function plural(count: number, noun: string): string {
  return count === 1 ? `1 ${noun}` : `${count} ${noun}s`;
}

/** How likely a spot's likeliest pair is to be the wrong way round, in words; null when it is not worth a word. */
export function chanceWords(chance: number): string | null {
  if (chance >= 0.4) return 'about even';
  if (chance >= 0.2) return 'could go either way';
  if (chance >= 0.1) return 'likely right, not sure';
  return null;
}

const NUMBER_WORDS = ['', 'one', 'two', 'three', 'four'];

function SpotCard({ spot, labelOf }: { spot: Spot; labelOf: (id: string) => string }) {
  const words = chanceWords(spot.chance);
  const answer = (ref: AnswerRef): string =>
    ref.draw
      ? `Can't decide between ${labelOf(ref.winner)} and ${labelOf(ref.loser)}, answer ${ref.answer}.`
      : `${labelOf(ref.winner)} over ${labelOf(ref.loser)}, answer ${ref.answer}.`;

  let heading: string;
  let body: ReactNode = null;
  let settles: string;
  switch (spot.kind) {
    case 'circle': {
      heading = 'These answers go in a circle';
      const count = NUMBER_WORDS[spot.items.length] ?? String(spot.items.length);
      body = (
        <>
          {spot.items.length <= MAX_CIRCLE_PICTURE ? (
            <CirclePicture spot={spot} labelOf={labelOf} />
          ) : (
            <Text style={styles.body}>
              {[...spot.items, spot.items[0] as string].map(labelOf).join(' over ')}
            </Text>
          )}
          <Text style={styles.body}>
            {`Each answer makes sense alone, but together they can't all be right, so Pairwise can't tell which of the ${count} goes first.`}
          </Text>
        </>
      );
      settles = 'One more answer between any two of these breaks the circle.';
      break;
    }
    case 'both-ways':
      heading = "You've picked both ways";
      body = <Answers lines={spot.answers.map(answer)} />;
      settles = 'Another answer between these two decides it.';
      break;
    case 'undecided':
      heading = "You couldn't decide between these";
      body = <PairRow above={labelOf(spot.above)} below={labelOf(spot.below)} />;
      settles =
        "If they really are even, their order doesn't matter much. If not, a clear answer settles it.";
      break;
    case 'inferred':
      heading = 'Never compared directly';
      body = (
        <>
          <PairRow above={labelOf(spot.above)} below={labelOf(spot.below)} />
          {spot.chain.length > 0 ? (
            <Answers lines={spot.chain.map(answer)} />
          ) : (
            <Text style={styles.body}>Their order comes from how each did against other items.</Text>
          )}
        </>
      );
      settles = 'Comparing them directly settles it.';
      break;
    case 'moved':
      heading = `You moved ${labelOf(spot.item)} here`;
      settles = 'A question or two about it will confirm the spot.';
      break;
    case 'one-answer':
      heading = 'Only one answer between these';
      body = <Answers lines={spot.answers.map(answer)} />;
      settles = 'Another answer would confirm it.';
      break;
  }

  return (
    <View style={styles.spot}>
      <View style={styles.spotHeader}>
        <Text style={styles.spotHeading}>{heading}</Text>
        {words !== null && <Text style={styles.chance}>{words}</Text>}
      </View>
      {body}
      <Text style={styles.body}>
        {settles}
        {spot.next && <Text style={styles.next}>{' The next question is about this.'}</Text>}
      </Text>
    </View>
  );
}

function Answers({ lines }: { lines: string[] }) {
  return (
    <View style={styles.answers}>
      {lines.map((line, index) => (
        <Text key={index} style={styles.answer}>
          {line}
        </Text>
      ))}
    </View>
  );
}

function PairRow({ above, below }: { above: string; below: string }) {
  return (
    <View style={styles.pairRow}>
      <Text style={styles.chip}>{above}</Text>
      <Text style={styles.meta}>and</Text>
      <Text style={styles.chip}>{below}</Text>
    </View>
  );
}

/**
 * The circle as a loop: each item over the next down a column, and a bracket
 * on the right from the last back up to the first. The words are the label,
 * so a screen reader hears the answers rather than the drawing.
 */
function CirclePicture({
  spot,
  labelOf,
}: {
  spot: Extract<Spot, { kind: 'circle' }>;
  labelOf: (id: string) => string;
}) {
  const { items, answers } = spot;
  const back = answers.at(-1) as AnswerRef;
  const label = answers
    .map((ref) => `${labelOf(ref.winner)} over ${labelOf(ref.loser)}, answer ${ref.answer}`)
    .join('. ');
  return (
    <View style={styles.circle} role="img" aria-label={`${label}.`} testID="progress-circle">
      <View style={styles.circleColumn}>
        {items.map((id, index) => (
          <View key={id} style={styles.circleStep}>
            <Text style={[styles.chip, styles.circleChip]}>{labelOf(id)}</Text>
            {index < items.length - 1 && (
              <Text
                style={styles.arrowDown}
              >{`↓  over, answer ${(answers[index] as AnswerRef).answer}`}</Text>
            )}
          </View>
        ))}
      </View>
      <View style={styles.bracket}>
        <Text style={styles.arrowBack}>◀</Text>
        <Text style={styles.bracketLabel}>{`over, answer ${back.answer}`}</Text>
      </View>
    </View>
  );
}

const CHIP_HEIGHT = 32;

const styles = StyleSheet.create({
  body: { ...typeScale.body, fontFamily: fonts.body, color: colors.textPrimary },
  meta: { ...typeScale.meta, fontFamily: fonts.body, color: colors.textSecondary },
  next: { fontWeight: '600', color: colors.accentStrong },
  spot: {
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  spotHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: space.md,
    flexWrap: 'wrap',
  },
  spotHeading: {
    ...typeScale.body,
    fontFamily: fonts.heading,
    fontWeight: '600',
    color: colors.textPrimary,
    flexShrink: 1,
  },
  chance: { ...typeScale.meta, fontFamily: fonts.body, color: colors.textSecondary },
  answers: { gap: space.xs },
  answer: { ...typeScale.meta, fontFamily: fonts.body, color: colors.textSecondary },
  pairRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' },
  chip: {
    ...typeScale.meta,
    fontFamily: fonts.body,
    color: colors.textPrimary,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  circle: { flexDirection: 'row', alignSelf: 'flex-start', gap: space.sm },
  circleColumn: { gap: 0 },
  circleStep: { alignItems: 'flex-start' },
  circleChip: { minHeight: CHIP_HEIGHT, minWidth: 160 },
  arrowDown: {
    ...typeScale.meta,
    fontFamily: fonts.body,
    color: colors.textSecondary,
    paddingVertical: space.xs,
    paddingLeft: space.md,
  },
  // From the middle of the first chip to the middle of the last.
  bracket: {
    marginVertical: CHIP_HEIGHT / 2,
    width: 28,
    borderTopWidth: 2,
    borderRightWidth: 2,
    borderBottomWidth: 2,
    borderColor: colors.textFaint,
    borderTopRightRadius: radius.sm,
    borderBottomRightRadius: radius.sm,
    justifyContent: 'center',
  },
  arrowBack: {
    position: 'absolute',
    top: -9,
    left: -8,
    fontSize: 10,
    lineHeight: 16,
    color: colors.textFaint,
  },
  bracketLabel: {
    ...typeScale.meta,
    fontFamily: fonts.body,
    color: colors.textSecondary,
    position: 'absolute',
    left: 36,
    width: 120,
  },
});
