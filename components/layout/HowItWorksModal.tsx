import { useCallback, useState } from 'react';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ItemCard } from '@/components/comparison/ItemCard';
import { GuideBrowser } from '@/components/layout/GuideBrowser';
import { GuideFaq } from '@/components/layout/GuideFaq';
import { B, GuideLink, K, P } from '@/components/layout/GuideProse';
import { Modal } from '@/components/ui/Modal';
import { colors, fonts, radius, space } from '@/lib/theme';
import type { ListItem } from '@/types/list';

export interface HowItWorksModalProps {
  visible: boolean;
  onClose: () => void;
}

type Tab = 'quick' | 'guide' | 'faq';

const TABS: { id: Tab; label: string }[] = [
  { id: 'quick', label: 'Quick start' },
  { id: 'guide', label: 'Full guide' },
  { id: 'faq', label: 'Questions' },
];

/**
 * A window rather than a page of its own, so opening it from the setup screen
 * never costs a list pasted but not yet ranked.
 */
export function HowItWorksModal({ visible, onClose }: HowItWorksModalProps) {
  const [tab, setTab] = useState<Tab>('quick');
  // Kept across tabs, so going to the questions and back returns to the same page of the guide.
  const [topicId, setTopicId] = useState<string | null>(null);

  const openTopic = useCallback((id: string | null) => {
    setTopicId(id);
    setTab('guide');
  }, []);
  const openFaq = useCallback(() => setTab('faq'), []);

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

      {tab === 'guide' ? (
        <GuideBrowser topicId={topicId} onSelect={setTopicId} onOpenFaq={openFaq} />
      ) : tab === 'faq' ? (
        <GuideFaq onOpenTopic={openTopic} />
      ) : (
        <QuickStart onOpenTopic={openTopic} onOpenFaq={openFaq} />
      )}
    </Modal>
  );
}

function QuickStart({
  onOpenTopic,
  onOpenFaq,
}: {
  onOpenTopic: (topicId: string | null) => void;
  onOpenFaq: () => void;
}) {
  return (
    <>
      <Section title="What this is">
        <P>
          Pairwise takes a list of things - books, ideas, candidates, anything - and puts it in order by
          asking simple one-on-one questions, instead of making you sort the whole list at once. Everything
          runs in your browser; your list is never uploaded.
        </P>
      </Section>

      <Section title="1. Bring in a list">
        <P>
          Paste it, type it, or drop a file: one item per line, or YAML or JSON if your items carry details
          like a year or a link. No list handy? Try one of the sample buttons. Then press <B>Start ranking</B>
          .
        </P>
      </Section>

      <Section title="2. Pick a side">
        <P>
          Each round shows two items, just like this. Choose the one you prefer, or mark it{' '}
          <B>“Much better”</B> when it isn&apos;t close. Too close to call? Press <B>“Can&apos;t decide”</B>{' '}
          and move on to the next one. If you don&apos;t know one of them, press{' '}
          <B>“Don&apos;t recognize…”</B>, then click that card: it waits at the bottom of the ranked list
          instead of being asked about. To take an item out of the list altogether, use the trash can at the
          bottom left of its card. Above the cards, the app counts your answers so far. Under the count, a
          line says how close the order is. Until every item has been compared at least once it cannot tell,
          and says how many are left; after that it names one of four levels, from a rough order to one where
          changes should be small. It is a guide drawn from your own answers, not a promise. A list that
          started already ranked gets no level, because the app cannot tell a good starting order from a bad
          one; it says so instead.
        </P>
        <ChooseSideDiagram />
      </Section>

      <Section title="3. Watch the order take shape">
        <P>
          The ranked list beside the cards updates after every answer, so you can stop as soon as it looks
          right. Every item starts even - unless you told it the list was roughly or already ranked best to
          worst, in which case it starts from that order and your answers refine it.
        </P>
        <P>
          Each answer is weighed against all the others, so it nudges the winner up and the loser down, and
          anything compared with either of them shifts a little too. The app keeps asking about whichever pair
          will sharpen the order most, rather than comparing every possible pair.
        </P>
      </Section>

      <Section title="Good to know">
        <P>
          Rows you didn&apos;t touch may move while you rank, especially early on. That is the list re-working
          itself from everything you have said, not a mistake. The{' '}
          <GuideLink onPress={onOpenFaq}>questions</GuideLink> explain why.
        </P>
      </Section>

      <Section title="4. Take it with you">
        <P>
          The <K>YAML</K>, <K>JSON</K> and <K>Plain list</K> tabs show your own document with the list in its
          new order, ready to copy or download. To carry on later, use <K>Save session</K>: it keeps every
          answer, and <K>Open session</K> brings you back to the same place.
        </P>
      </Section>

      <Section title="There is more">
        <P>
          Choosing what each card shows, drawing fields as links, pictures, star ratings and more, moving
          items by hand, list setup, keyboard shortcuts and more are in the{' '}
          <GuideLink onPress={() => onOpenTopic(null)}>full guide</GuideLink>.
        </P>
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
  createdAt: '',
  updatedAt: '',
};

const SAMPLE_ITEM_B: ListItem = { ...SAMPLE_ITEM_A, id: 'how-it-works-sample-b', value: 'Option B' };

function noop() {}

/** The real comparison cards, gutter, and Can't decide control - not a mockup. */
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
      <Pressable accessibilityRole="button" accessibilityLabel="Example: can't decide" style={styles.skip}>
        <Text style={styles.skipText}>Can&apos;t decide</Text>
      </Pressable>
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
});
