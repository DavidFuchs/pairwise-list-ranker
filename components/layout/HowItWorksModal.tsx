import { useState } from 'react';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ItemCard } from '@/components/comparison/ItemCard';
import { GuideTopics } from '@/components/layout/GuideTopics';
import { Modal } from '@/components/ui/Modal';
import { ProgressMeter } from '@/components/ui/ProgressMeter';
import { describeCoverage } from '@/lib/state/selectors';
import { colors, fonts, radius, space, typeScale } from '@/lib/theme';
import type { ListItem } from '@/types/list';

export interface HowItWorksModalProps {
  visible: boolean;
  onClose: () => void;
}

type Tab = 'quick' | 'guide';

const TABS: { id: Tab; label: string }[] = [
  { id: 'quick', label: 'Quick start' },
  { id: 'guide', label: 'Full guide' },
];

/**
 * A window rather than a page of its own, so opening it from the setup screen
 * never costs a list pasted but not yet ranked.
 */
export function HowItWorksModal({ visible, onClose }: HowItWorksModalProps) {
  const [tab, setTab] = useState<Tab>('quick');

  return (
    <Modal visible={visible} onClose={onClose} title="How Pairwise works">
      <View style={styles.tabs} role="tablist">
        {TABS.map((option) => {
          const selected = option.id === tab;
          return (
            <Pressable
              key={option.id}
              role="tab"
              accessibilityLabel={option.label}
              aria-selected={selected}
              onPress={() => setTab(option.id)}
              style={[styles.tab, selected && styles.tabSelected]}
            >
              <Text style={[styles.tabLabel, selected && styles.tabLabelSelected]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {tab === 'guide' ? <GuideTopics /> : <QuickStart onOpenGuide={() => setTab('guide')} />}
    </Modal>
  );
}

function QuickStart({ onOpenGuide }: { onOpenGuide: () => void }) {
  return (
    <>
      <Section title="What this is">
        <Text style={styles.body}>
          Pairwise takes a list of things - books, ideas, candidates, anything - and puts it in
          order by asking simple one-on-one questions, instead of making you sort the whole list
          at once.
        </Text>
      </Section>

      <Section title="Pick a side">
        <Text style={styles.body}>
          Each round shows two items, just like this. Choose the one you prefer, or mark it{' '}
          <Text style={styles.emphasis}>“Much better”</Text> when it isn&apos;t close.
          Can&apos;t compare them fairly? Skip the pair and move on to the next one. To take an
          item out of the list altogether, use the trash can at the bottom left of its card.
        </Text>
        <ChooseSideDiagram />
      </Section>

      <Section title="What the progress bar means">
        <Text style={styles.body}>
          It is an estimate, not a finish line. The bar weighs the choices you have made against
          how many a list this size usually takes to settle - so it tracks how sure the order is
          getting, not how much work is left. The ranking is worth reading long before the bar
          fills, and carrying on past it is not wasted effort: the meter plates itself gold and
          keeps counting, because every further comparison still sharpens the order. Skipped pairs
          do not count toward it, since a skip tells the app nothing, and removing an item changes
          the estimate, so the number can shift.
        </Text>
        <ProgressDiagram />
      </Section>

      <Section title="How the ranking is built">
        <Text style={styles.body}>
          Every item starts even - unless you told it the list was already ranked best to worst,
          in which case it starts from that order instead, so comparisons refine it rather than
          rebuild it from scratch. Each choice you make nudges the winner&apos;s rating up and the
          loser&apos;s down - a bit more for a “Much better” pick. Rather than comparing every
          possible pair, the app keeps choosing whichever pair is most likely to sharpen the
          order: usually two items with close ratings that haven&apos;t faced off yet. The ranking
          updates after every answer, so you can stop as soon as it looks right.
        </Text>
        <RatingShiftDiagram />
      </Section>

      <Section title="There is more">
        <Text style={styles.body}>
          Choosing what each card shows, drawing fields as links, pictures, star ratings and more,
          moving items by hand, keyboard shortcuts, and saving a session to carry on later are all covered in the{' '}
          <Text accessibilityRole="link" onPress={onOpenGuide} style={styles.guideLink}>
            full guide
          </Text>
          .
        </Text>
      </Section>
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

const SAMPLE_ITEM_A: ListItem = {
  id: 'how-it-works-sample-a',
  listId: 'how-it-works-sample',
  value: 'Option A',
  active: true,
  createdAt: '',
  updatedAt: '',
};

const SAMPLE_ITEM_B: ListItem = { ...SAMPLE_ITEM_A, id: 'how-it-works-sample-b', value: 'Option B' };

function noop() {}

/** The real comparison cards, gutter, and skip control - not a mockup. */
function ChooseSideDiagram() {
  return (
    <View style={styles.diagramWrap}>
      <View style={styles.cards}>
        <ItemCard item={SAMPLE_ITEM_A} side="left" onChoose={noop} onChooseStrong={noop} />
        <View style={styles.gutter} aria-hidden>
          <View style={styles.gutterLine} />
          <Text style={styles.gutterText}>or</Text>
          <View style={styles.gutterLine} />
        </View>
        <ItemCard item={SAMPLE_ITEM_B} side="right" onChoose={noop} onChooseStrong={noop} />
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Example: skip this pair" style={styles.skip}>
        <Text style={styles.skipText}>Skip this pair</Text>
      </Pressable>
    </View>
  );
}

/** The real status strip and meter, before and after the estimate. */
function ProgressDiagram() {
  return (
    <View style={styles.progressBlock} aria-hidden>
      <ProgressRow caption="8 comparisons · 6 items" coverage={0.52} />
      <ProgressRow caption="21 comparisons · 6 items" coverage={1.38} />
    </View>
  );
}

function ProgressRow({ caption, coverage }: { caption: string; coverage: number }) {
  return (
    <View style={styles.progressRowBlock}>
      <View style={styles.progressRow}>
        <Text style={styles.progressStatus}>{caption}</Text>
        <Text style={styles.progressPercent}>{describeCoverage(coverage).label}</Text>
      </View>
      <ProgressMeter coverage={coverage} />
    </View>
  );
}

/** Two rating bars moving apart after a single decision. */
function RatingShiftDiagram() {
  return (
    <View style={styles.ratingBlock} aria-hidden>
      <RatingRow label="Winner" after={0.62} direction="up" />
      <RatingRow label="Runner-up" after={0.38} direction="down" />
    </View>
  );
}

function RatingRow({
  label,
  after,
  direction,
}: {
  label: string;
  after: number;
  direction: 'up' | 'down';
}) {
  return (
    <View style={styles.ratingRow}>
      <Text style={styles.ratingLabel}>{label}</Text>
      <View style={styles.ratingTrack}>
        <View style={[styles.ratingFillBase, { width: '50%' }]} />
        <View
          style={[
            styles.ratingFillAfter,
            direction === 'up' ? styles.ratingFillUp : styles.ratingFillDown,
            { width: `${after * 100}%` },
          ]}
        />
      </View>
      <Text style={[styles.ratingArrow, direction === 'down' && styles.ratingArrowDown]}>
        {direction === 'up' ? '↑' : '↓'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.sm },
  sectionTitle: {
    fontFamily: fonts.heading,
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  body: { ...typeScale.meta, fontFamily: fonts.body, color: colors.textSecondary },
  emphasis: { color: colors.accentStrong, fontWeight: '600' },
  guideLink: { color: colors.accentStrong, fontWeight: '600', textDecorationLine: 'underline' },

  // Mirrors PreviewTabs, the app's other set of tabs.
  tabs: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    gap: space.xs,
    padding: space.xs,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSunken,
  },
  tab: { paddingVertical: space.xs, paddingHorizontal: space.md, borderRadius: radius.sm },
  tabSelected: { backgroundColor: colors.surface },
  tabLabel: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },
  tabLabelSelected: { color: colors.textPrimary, fontWeight: '600' },

  // Choose-a-side diagram: mirrors ComparisonDeck's cards/gutter/skip exactly.
  diagramWrap: { alignItems: 'center', gap: space.sm, paddingTop: space.sm },
  cards: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'stretch',
    justifyContent: 'center',
    gap: space.md,
  },
  gutter: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingHorizontal: space.xs,
  },
  gutterLine: { flex: 1, width: 1, minHeight: space.lg, backgroundColor: colors.border },
  gutterText: {
    fontFamily: fonts.body,
    fontSize: 11,
    letterSpacing: 0.4,
    color: colors.textFaint,
  },
  skip: {
    paddingVertical: space.sm,
    paddingHorizontal: space.lg,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
  },
  skipText: {
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },

  // Progress diagram: mirrors ComparisonDeck's status strip and meter.
  progressBlock: { gap: space.md, paddingTop: space.sm },
  progressRowBlock: { gap: space.sm },
  progressRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progressStatus: {
    fontFamily: fonts.mono,
    fontSize: 12,
    letterSpacing: 0.4,
    color: colors.textSecondary,
  },
  progressPercent: { fontFamily: fonts.mono, fontSize: 11, color: colors.textFaint },

  // Rating-shift diagram
  ratingBlock: { gap: space.xs, paddingTop: space.sm },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  ratingLabel: { width: 68, fontFamily: fonts.body, fontSize: 11, color: colors.textSecondary },
  ratingTrack: {
    flex: 1,
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.surfaceMuted,
    overflow: 'hidden',
  },
  ratingFillBase: { position: 'absolute', height: 8, backgroundColor: colors.border },
  ratingFillAfter: { height: 8, borderRadius: 999 },
  ratingFillUp: { backgroundColor: colors.accent },
  ratingFillDown: { backgroundColor: colors.textFaint },
  ratingArrow: { width: 14, fontFamily: fonts.body, fontSize: 13, color: colors.accentStrong },
  ratingArrowDown: { color: colors.textFaint },
});
