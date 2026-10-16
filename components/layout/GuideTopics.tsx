import { useState } from 'react';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FieldImage } from '@/components/preview/FieldImage';
import { FieldLink } from '@/components/preview/FieldLink';
import { FieldValue, RatingBar, StarRating } from '@/components/preview/FieldValue';
import { PreviewButtonPlaceholder } from '@/components/preview/PreviewButton';
import { colors, fonts, radius, space, typeScale } from '@/lib/theme';

/**
 * The full reference, one topic at a time. Topics open in place rather than
 * scrolling past each other, so the list of them doubles as the contents.
 */
export function GuideTopics() {
  const [open, setOpen] = useState<string | null>(TOPICS[0]!.title);

  return (
    <View style={styles.topics}>
      {TOPICS.map((topic) => {
        const expanded = open === topic.title;
        return (
          <View key={topic.title} style={[styles.topic, expanded && styles.topicOpen]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={topic.title}
              aria-expanded={expanded}
              onPress={() => setOpen(expanded ? null : topic.title)}
              style={styles.topicHeader}
            >
              <View style={styles.topicHeading}>
                <Text style={styles.topicTitle}>{topic.title}</Text>
                <Text style={styles.topicSummary}>{topic.summary}</Text>
              </View>
              <Text style={styles.chevron}>{expanded ? '▴' : '▾'}</Text>
            </Pressable>
            {expanded && <View style={styles.topicBody}>{topic.body}</View>}
          </View>
        );
      })}
    </View>
  );
}

function P({ children }: { children: ReactNode }) {
  return <Text style={styles.body}>{children}</Text>;
}

function B({ children }: { children: ReactNode }) {
  return <Text style={styles.strong}>{children}</Text>;
}

/** A key or control name, set like the shortcut line under the cards. */
function K({ children }: { children: ReactNode }) {
  return <Text style={styles.key}>{children}</Text>;
}

function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <View style={styles.bullets}>
      {items.map((item, index) => (
        <View key={index} style={styles.bullet}>
          <Text style={styles.bulletMark}>•</Text>
          <Text style={[styles.body, styles.bulletText]}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

/** One way of drawing a field: its name, when it is offered, what it does, and a live example. */
function Renderer({
  name,
  offered,
  example,
  children,
}: {
  name: string;
  offered: string;
  example: ReactNode;
  children: ReactNode;
}) {
  return (
    <View style={styles.renderer}>
      <View style={styles.rendererText}>
        <Text style={styles.rendererName}>{name}</Text>
        <Text style={styles.rendererOffered}>{offered}</Text>
        <Text style={styles.body}>{children}</Text>
      </View>
      <View style={styles.rendererExample} aria-hidden>
        {example}
      </View>
    </View>
  );
}

// Above TOPICS, whose elements are built when the module loads.
const styles = StyleSheet.create({
  topics: { gap: space.xs },
  topic: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSunken,
    overflow: 'hidden',
  },
  topicOpen: { backgroundColor: colors.surface },
  topicHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.sm + 2,
    paddingHorizontal: space.md,
  },
  topicHeading: { flex: 1, gap: 2 },
  topicTitle: { fontFamily: fonts.heading, fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  topicSummary: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },
  chevron: { fontFamily: fonts.body, fontSize: 14, color: colors.textSecondary },
  topicBody: {
    gap: space.md,
    paddingHorizontal: space.md,
    paddingTop: space.sm,
    paddingBottom: space.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  body: { ...typeScale.meta, fontFamily: fonts.body, color: colors.textSecondary },
  strong: { color: colors.textPrimary, fontWeight: '600' },
  key: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.textPrimary,
  },
  warning: { color: colors.warningText },
  bullets: { gap: space.sm },
  bullet: { flexDirection: 'row', gap: space.sm },
  bulletMark: { ...typeScale.meta, color: colors.textFaint },
  bulletText: { flex: 1 },
  renderer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rendererText: { flexGrow: 1, flexShrink: 1, flexBasis: 280, gap: 4 },
  rendererName: { fontFamily: fonts.heading, fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  rendererOffered: { fontFamily: fonts.body, fontSize: 12, color: colors.textFaint },
  rendererExample: { minWidth: 120, alignItems: 'center', justifyContent: 'center' },
  exampleChip: {
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: 999,
    backgroundColor: colors.surfaceMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textSecondary,
    overflow: 'hidden',
  },
  exampleText: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },
  // Groups the renderers, set like the setup list's section labels.
  group: {
    marginTop: space.xs,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: colors.textFaint,
  },
  exampleLink: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },
  imageExample: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm },
});

const TOPICS: { title: string; summary: string; body: ReactNode }[] = [
  {
    title: 'Bringing in your list',
    summary: 'Paste, type or drop a file - plain text, YAML or JSON.',
    body: (
      <>
        <P>
          Paste your list into the box, type it, or drop a file anywhere on the page. A{' '}
          <B>plain list</B> is one item per line. <B>YAML</B> and <B>JSON</B> can carry more about
          each item - an artist, a year, a link - and those details can then be shown while you
          rank.
        </P>
        <P>
          The format is detected for you. If it guesses wrong, pick <K>Plain list</K>, <K>YAML</K>{' '}
          or <K>JSON</K> under the box to read it that way instead. The sample buttons there load a
          ready-made list to try the app with.
        </P>
        <P>
          A YAML or JSON document can hold more than one list. When it does, the panel on the right
          asks which one to rank; the rest of the document is kept exactly as it was and comes back
          with your export.
        </P>
      </>
    ),
  },
  {
    title: 'Already ranked, or in no order?',
    summary: 'Start from your existing order, or from scratch.',
    body: (
      <P>
        Choose <B>Best to worst</B> when your list is already roughly ranked. Every item then
        starts from the position it has, and your comparisons refine that order rather than
        rebuilding it. Choose <B>No particular order</B> and every item starts even.
      </P>
    ),
  },
  {
    title: 'Choosing what each card shows',
    summary: 'The title, the details under it, and their order.',
    body: (
      <>
        <P>
          For a list of objects, the <B>Fields</B> panel lists every field your items have, each
          with a few of its values so you can see what it holds. Fields on the cards are grouped at
          the top, in the order a card shows them.
        </P>
        <Bullets
          items={[
            <>
              <B>Title.</B> The first field titles each card to begin with. Tap any other field to
              make it the title instead. Lists and nested objects cannot be titles. A title is always
              shown as it is written in your data - it has no other way to be drawn.
            </>,
            <>
              <B>Details.</B> Tick the box on the left of a field to show it on every card under the
              title - as many as you like. Nothing is ticked until you tick it. The number in the
              box is the field&apos;s place on the card.
            </>,
            <>
              <B>Order.</B> Use the <K>▲</K> <K>▼</K> arrows on a ticked field to move it up or down
              the card.
            </>,
            <>
              <B>How it is drawn.</B> Where a field can be drawn more than one way, the <K>▾</K>{' '}
              button on its right opens the choices, each previewed with your own values. The cell
              then shows what you chose. See <B>Ways to draw a field</B>.
            </>,
          ]}
        />
        <P>
          A count like <Text style={styles.warning}>9 of 12</Text> means only some items have that
          field. Cards for the others show a dash in its place, so the two cards in a pair always
          line up.
        </P>
      </>
    ),
  },
  {
    title: 'Ways to draw a field',
    summary: 'Text, links, pictures, tags, dates, durations, ratings and more.',
    body: (
      <>
        <P>
          Each way is offered only when every value the field holds suits it - a field where even
          one value is not a web address is never offered as a link. The ranked list shows each row
          as one line, so there the visual ones are written out instead: stars read{' '}
          <K>★ 9.2/10</K>, tags read as a list.
        </P>

        <Text style={styles.group}>Text and numbers</Text>
        <Renderer
          name="Text"
          offered="Always offered. The choices name the field's type - string, number, and so on."
          example={<Text style={styles.exampleChip}>year: 2016</Text>}
        >
          The value as written, after the field&apos;s name.
        </Renderer>
        <Renderer
          name="Date and Year only"
          offered="Offered when every value is a date written year first: 2024-04-12, with or without a time."
          example={<FieldValue field="released" value="2024-04-12" renderer="date" withKey textStyle={styles.exampleText} />}
        >
          <B>Date</B> writes it the way dates are written where you are. <B>Year only</B> keeps just
          the year - often all a comparison needs.
        </Renderer>
        <Renderer
          name="Duration (seconds)"
          offered="Offered when every value is a whole number of zero or more."
          example={<FieldValue field="length" value={171} renderer="duration" withKey textStyle={styles.exampleText} />}
        >
          Reads the number as seconds: 171 becomes 2:51, and 3735 becomes 1:02:15. Nothing in a
          plain number says it is seconds, so only choose it when it is.
        </Renderer>
        <Renderer
          name="Compact number"
          offered="Offered when every value is a number and at least one reaches 1,000."
          example={<FieldValue field="plays" value={1534000} renderer="compact" withKey textStyle={styles.exampleText} />}
        >
          Shortens large numbers - 1,534,000 becomes 1.5M - for play counts, populations, prices.
        </Renderer>

        <Text style={styles.group}>Lists and yes-or-no</Text>
        <Renderer
          name="Tags"
          offered="Offered when every value is a list of words or numbers."
          example={<FieldValue field="genres" value={['Pop', 'Disco']} renderer="tags" withKey textStyle={styles.exampleText} />}
        >
          Each entry as its own small label, instead of the list written out in brackets. An empty
          list shows a dash.
        </Renderer>
        <Renderer
          name="Badge"
          offered="Offered when every value is true or false."
          example={<FieldValue field="explicit" value renderer="badge" />}
        >
          Shows the field&apos;s name as a label when the value is true, and nothing at all when it
          is false - quieter than a line saying false on every card.
        </Renderer>

        <Text style={styles.group}>Ratings</Text>
        <P>
          Both ask what the score is <B>out of</B>: 1, 5, 10 or 100. Only scales that every value
          fits under are offered, so a field with a 9.2 in it is never offered out of 5. Out of 1 and
          out of 100 read as percentages.
        </P>
        <Renderer
          name="Stars"
          offered="Offered when every value is a number of zero or more."
          example={<StarRating value={9.2} scale={10} size={16} />}
        >
          Always five stars, lit from the left to the score&apos;s share of the scale. 9.2 out of 10
          lights 92% of the row, so the last star is mostly grey.
        </Renderer>
        <Renderer
          name="Bar"
          offered="Offered when every value is a number of zero or more."
          example={<RatingBar value={9.2} scale={10} />}
        >
          A short bar filled to the score, with the score written beside it.
        </Renderer>

        <Text style={styles.group}>Links, pictures and sound</Text>
        <Renderer
          name="Link"
          offered="Offered when every value starts with http:// or https://."
          example={<FieldLink url="https://example.com/arrival" prefix="site:" textStyle={styles.exampleLink} />}
        >
          A link that opens in a new tab. Clicking it never chooses the card. In the ranked list,
          where a row is something you drag, it reads as plain text.
        </Renderer>
        <Renderer
          name="Image"
          offered="Offered when every value is a link ending in .png, .jpg, .jpeg, .gif, .webp, .avif, .svg, .bmp or .ico."
          example={
            <View style={styles.imageExample}>
              <FieldImage value={undefined} size={56} label="" />
              <FieldImage value={undefined} size={28} label="" />
            </View>
          }
        >
          A picture to the left of each comparison card&apos;s title, and a small one at the start
          of each row in the ranked list. Anything after a <K>?</K> or <K>#</K> in the address is
          ignored, so <K>…/cover.jpg?w=300</K> counts. An item whose picture is missing or will not
          load keeps an empty frame, so everything still lines up.
        </Renderer>
        <Renderer
          name="YouTube thumbnail"
          offered="Offered when every value is a YouTube video address - watch, youtu.be, shorts, embed or live."
          example={<FieldImage value={undefined} size={56} label="" />}
        >
          The video&apos;s own picture, in the same place an image goes, marked with a small play
          sign. Clicking it on a card opens the video in a new tab, without choosing the card.
        </Renderer>
        <Renderer
          name="Apple Music preview"
          offered="Offered when every value is text or a number - meant for Apple Music track ids."
          example={<PreviewButtonPlaceholder />}
        >
          A round play button for a 30-second clip of the track, at the top right of each card, near
          the end of each ranked row, and on the field itself while you set up. Clips are looked up
          in Apple Music&apos;s catalogue; a track with no clip simply has no button.
        </Renderer>
        <P>
          A card has room for one picture and one play button. If two fields ask for either, the
          first in the card&apos;s order gets it, and the second falls back: a second image or video
          shows as a link, a second track id as text.
        </P>
      </>
    ),
  },
  {
    title: 'Writing the order into your data',
    summary: 'Optional: fill a field with each item’s new position.',
    body: (
      <P>
        Your export is always in ranked order, so this is optional. If your items have a field for
        their position - a rank, an order - choose it under <B>Write the new order into</B> and the
        export rewrites it with 1, 2, 3 and so on, top to bottom.
      </P>
    ),
  },
  {
    title: 'Comparing',
    summary: 'Choosing, skipping, removing, undoing - and the keyboard.',
    body: (
      <>
        <Bullets
          items={[
            <>
              <B>Choose</B> by clicking anywhere on the card you prefer. <K>Much better</K> counts
              for more, for when it is not close.
            </>,
            <>
              <B>Skip this pair</B> when you cannot compare them fairly. A skip records nothing.
            </>,
            <>
              <B>Remove</B> an item with the trash can at the bottom left of its card, then confirm.
              It is left out of the ranking and the export.
            </>,
            <>
              <B>Undo</B> takes back your last decision.
            </>,
            <>
              <B>Show details</B> opens every field of both items, for the times the card&apos;s
              summary is not enough.
            </>,
          ]}
        />
        <P>From the keyboard:</P>
        <Bullets
          items={[
            <>
              <K>←</K> <K>→</K> choose the left or right card; hold <K>Shift</K> for much better.
            </>,
            <>
              <K>S</K> skips the pair.
            </>,
            <>
              <K>D</K> then <K>L</K> or <K>R</K> removes the left or right item; <K>Enter</K>{' '}
              confirms and <K>Esc</K> keeps it.
            </>,
            <>
              <K>Ctrl</K>/<K>Cmd</K> + <K>Z</K> undoes.
            </>,
          ]}
        />
      </>
    ),
  },
  {
    title: 'The ranked list',
    summary: 'Read the order, and move items by hand.',
    body: (
      <>
        <P>
          The <B>Ranked</B> tab beside the cards shows the order as it stands, updated after every
          answer. The number at the end of each row is the item&apos;s rating.
        </P>
        <P>
          Drag a row by its <K>⠿</K> handle and drop it where the line shows: it lands exactly
          there, and nothing else moves. It is a starting point, not a pin - later comparisons can
          still move it. <K>Undo</K> takes a move back. From the keyboard, focus the handle and
          press <K>Alt</K> + <K>↑</K> or <K>↓</K>.
        </P>
      </>
    ),
  },
  {
    title: 'Several lists in one document',
    summary: 'Switch between them without losing progress.',
    body: (
      <>
        <P>
          When your document holds more than one list, the list name at the top of the ranking
          screen opens a switcher. Each list keeps its own progress, so you can move between them
          freely. <K>Configure</K> beside a list takes you back to set up its fields and order.
        </P>
        <P>
          Lists you have not set up yourself follow the document&apos;s defaults. When editing a
          list, <K>Set as default</K> makes its setup the default for the others.
        </P>
      </>
    ),
  },
  {
    title: 'Saving and exporting',
    summary: 'What is kept, where, and how to take it all with you in one file.',
    body: (
      <>
        <Bullets
          items={[
            <>
              <B>In this browser.</B> Your list and progress are saved here as you go, so a reload
              loses nothing. The top bar says when this is not possible.
            </>,
            <>
              <B>Exporting.</B> The <K>YAML</K>, <K>JSON</K> or <K>Plain list</K> tab shows your own
              document with the list put in ranked order and everything else untouched. Copy it or
              download it. That is your result to use elsewhere; to keep ranking later, save a
              session instead, since an export holds the order but not the decisions behind it.
            </>,
            <>
              <B>Session files.</B> <K>Save session</K>, beside the ranked list, puts everything
              in one file: your document, how every list is set up, and every decision, placement and
              removal. To carry on - in another browser, or months later - drop that file on the
              setup screen or choose it with <K>Choose a file</K>, and you are back where you left
              off. <K>Open session</K> does the same from the ranking screen. Opening one replaces
              the list you have open, so if that list has decisions behind it, you are asked first.
              Progress files saved before sessions existed still open, onto the same list.
            </>,
            <>
              <B>Editing.</B> <K>Edit data</K> returns to the setup screen. You see what your
              changes will do before they are applied.
            </>,
            <>
              <B>Start over</B> clears the list from this browser. Files you exported are not
              affected.
            </>,
          ]}
        />
      </>
    ),
  },
  {
    title: 'Privacy',
    summary: 'Your data stays in your browser.',
    body: (
      <P>
        There are no accounts and no server: your list is never uploaded. The only requests that
        leave your browser are the ones your own data asks for - pictures load from their
        addresses, and Apple Music previews look up their track ids with Apple.
      </P>
    ),
  },
];
