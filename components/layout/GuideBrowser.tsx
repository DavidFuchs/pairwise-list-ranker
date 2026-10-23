import { useEffect, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import type { ViewStyle } from 'react-native';

import { GUIDE_GROUPS, GUIDE_TOPICS } from '@/components/layout/GuideTopics';
import type { GuideTopic } from '@/components/layout/GuideTopics';
import { colors, fonts, radius, space } from '@/lib/theme';

/** Below this window width the contents and the article take turns instead of sitting side by side. */
const SIDE_BY_SIDE_FROM = 700;

export interface GuideBrowserProps {
  /** The topic being read; null on a narrow screen means the contents. */
  topicId: string | null;
  onSelect: (topicId: string | null) => void;
  onOpenFaq: () => void;
}

/**
 * The full guide. The contents is always in view beside the article (or, on a
 * narrow screen, is the page you come back to), so getting to a topic is one
 * tap from anywhere rather than a search through folded sections.
 */
export function GuideBrowser({ topicId, onSelect, onOpenFaq }: GuideBrowserProps) {
  const { width } = useWindowDimensions();
  const sideBySide = width >= SIDE_BY_SIDE_FROM;

  const topics = useMemo(() => {
    const open = (id: string) => (id === 'faq' ? onOpenFaq() : onSelect(id));
    return GUIDE_TOPICS.map((make) => make(open));
  }, [onOpenFaq, onSelect]);

  const current = topics.find((topic) => topic.id === topicId) ?? (sideBySide ? topics[0]! : null);

  // A new article starts at its top, however far down the last one was read.
  const articleRef = useRef<View>(null);
  const shown = useRef(current?.id);
  useEffect(() => {
    if (shown.current === current?.id) return;
    shown.current = current?.id;
    revealTop(articleRef.current as unknown as HTMLElement | null);
  }, [current?.id]);

  if (!sideBySide && current === null) {
    return <ContentsList topics={topics} onSelect={onSelect} />;
  }
  if (current === null) return null;

  const article = (
    <View ref={articleRef} style={styles.article}>
      {!sideBySide && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="All topics"
          onPress={() => onSelect(null)}
          style={styles.back}
        >
          <Text style={styles.backText}>‹ All topics</Text>
        </Pressable>
      )}
      <Article topic={current} topics={topics} onSelect={onSelect} onOpenFaq={onOpenFaq} />
    </View>
  );

  if (!sideBySide) return article;

  return (
    <View style={styles.split}>
      <View style={styles.nav} role="navigation" aria-label="Guide topics">
        {GUIDE_GROUPS.map((group) => (
          <View key={group.id} style={styles.navGroup}>
            <Text style={styles.groupTitle}>{group.title}</Text>
            {topics
              .filter((topic) => topic.group === group.id)
              .map((topic) => {
                const selected = topic.id === current.id;
                return (
                  <Pressable
                    key={topic.id}
                    accessibilityRole="button"
                    accessibilityLabel={topic.title}
                    aria-current={selected ? 'page' : undefined}
                    onPress={() => onSelect(topic.id)}
                    style={[styles.navItem, selected && styles.navItemSelected]}
                  >
                    <Text style={[styles.navLabel, selected && styles.navLabelSelected]}>{topic.title}</Text>
                  </Pressable>
                );
              })}
          </View>
        ))}
      </View>
      {article}
    </View>
  );
}

/**
 * Scrolls whatever scrolls the element just far enough to bring its top into
 * view. An element already showing its top is left alone, so choosing a topic
 * from the contents never shoves the tabs above it out of sight.
 */
function revealTop(element: HTMLElement | null) {
  let scroller = element?.parentElement ?? null;
  while (scroller !== null && scroller.scrollHeight <= scroller.clientHeight)
    scroller = scroller.parentElement;
  if (element === null || scroller === null) return;
  const gap = element.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
  if (gap < 0) scroller.scrollTop += gap - space.md;
}

function ContentsList({ topics, onSelect }: { topics: GuideTopic[]; onSelect: (topicId: string) => void }) {
  return (
    <View style={styles.contents}>
      {GUIDE_GROUPS.map((group) => (
        <View key={group.id} style={styles.contentsGroup}>
          <Text style={styles.groupTitle}>{group.title}</Text>
          {topics
            .filter((topic) => topic.group === group.id)
            .map((topic) => (
              <Pressable
                key={topic.id}
                accessibilityRole="button"
                accessibilityLabel={topic.title}
                onPress={() => onSelect(topic.id)}
                style={styles.contentsItem}
              >
                <View style={styles.contentsText}>
                  <Text style={styles.contentsTitle}>{topic.title}</Text>
                  <Text style={styles.contentsSummary}>{topic.summary}</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            ))}
        </View>
      ))}
    </View>
  );
}

function Article({
  topic,
  topics,
  onSelect,
  onOpenFaq,
}: {
  topic: GuideTopic;
  topics: GuideTopic[];
  onSelect: (topicId: string) => void;
  onOpenFaq: () => void;
}) {
  const index = topics.indexOf(topic);
  const previous = topics[index - 1];
  const next = topics[index + 1];
  const group = GUIDE_GROUPS.find((candidate) => candidate.id === topic.group);

  return (
    <View style={styles.articleBody}>
      <View style={styles.heading}>
        <Text style={styles.eyebrow}>{group?.title}</Text>
        <Text role="heading" aria-level={3} style={styles.title}>
          {topic.title}
        </Text>
        <Text style={styles.lead}>{topic.summary}</Text>
      </View>

      <View style={styles.text}>{topic.body}</View>

      <View style={styles.footer}>
        {previous !== undefined ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Previous: ${previous.title}`}
            onPress={() => onSelect(previous.id)}
            style={styles.step}
          >
            <Text style={styles.stepHint}>Previous</Text>
            <Text style={styles.stepTitle}>{`‹ ${previous.title}`}</Text>
          </Pressable>
        ) : (
          <View style={styles.step} />
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Next: ${next?.title ?? 'Questions and answers'}`}
          onPress={() => (next === undefined ? onOpenFaq() : onSelect(next.id))}
          style={[styles.step, styles.stepNext]}
        >
          <Text style={styles.stepHint}>Next</Text>
          <Text style={styles.stepTitle}>{`${next?.title ?? 'Questions and answers'} ›`}</Text>
        </Pressable>
      </View>
    </View>
  );
}

// Web-only: the contents stays put while a long article scrolls past it, and
// scrolls within itself when the window is too short to show all of it.
const stickyNav = {
  position: 'sticky',
  top: 0,
  maxHeight: 'calc(86vh - 9rem)',
  overflow: 'auto',
} as unknown as ViewStyle;

const styles = StyleSheet.create({
  split: { flexDirection: 'row', alignItems: 'flex-start', gap: space.lg },
  nav: {
    ...stickyNav,
    width: 208,
    flexShrink: 0,
    gap: space.md,
    paddingRight: space.sm,
  },
  navGroup: { gap: 2 },
  groupTitle: {
    paddingBottom: space.xs,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: colors.textFaint,
  },
  navItem: { paddingVertical: 6, paddingHorizontal: space.sm, borderRadius: radius.sm },
  navItemSelected: { backgroundColor: colors.accentSoft },
  navLabel: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary },
  navLabelSelected: { color: colors.accentStrong, fontWeight: '600' },

  article: { flex: 1, minWidth: 0, gap: space.md },
  back: { alignSelf: 'flex-start', paddingVertical: space.xs },
  backText: { fontFamily: fonts.body, fontSize: 13, fontWeight: '600', color: colors.accentStrong },
  articleBody: { gap: space.lg },
  heading: { gap: space.xs },
  eyebrow: {
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: colors.textFaint,
  },
  title: {
    fontFamily: fonts.heading,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  lead: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.textSecondary },
  text: { gap: space.md },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
    paddingTop: space.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  step: { flexGrow: 1, flexBasis: 180, gap: 2, paddingVertical: space.xs },
  stepNext: { alignItems: 'flex-end' },
  stepHint: { fontFamily: fonts.body, fontSize: 11, color: colors.textFaint },
  stepTitle: { fontFamily: fonts.body, fontSize: 13, fontWeight: '600', color: colors.accentStrong },

  contents: { gap: space.lg },
  contentsGroup: { gap: space.xs },
  contentsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.sm + 2,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSunken,
  },
  contentsText: { flex: 1, gap: 2 },
  contentsTitle: { fontFamily: fonts.heading, fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  contentsSummary: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },
  chevron: { fontFamily: fonts.body, fontSize: 18, color: colors.textFaint },
});
