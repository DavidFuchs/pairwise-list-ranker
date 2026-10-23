import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { B, Bullets, GuideLink, K, P, prose } from '@/components/layout/GuideProse';
import { FieldImage } from '@/components/preview/FieldImage';
import { FieldLink } from '@/components/preview/FieldLink';
import { FieldValue, RatingBar, StarRating } from '@/components/preview/FieldValue';
import { PreviewButtonPlaceholder } from '@/components/preview/PreviewButton';
import { colors, fonts, radius, space } from '@/lib/theme';

export type GuideGroupId = 'setup' | 'rank' | 'keep';

/** The guide's sections, in the order the contents shows them: what someone does, start to finish. */
export const GUIDE_GROUPS: { id: GuideGroupId; title: string }[] = [
  { id: 'setup', title: 'Set up your list' },
  { id: 'rank', title: 'Rank it' },
  { id: 'keep', title: 'Keep your result' },
];

export interface GuideTopic {
  id: string;
  group: GuideGroupId;
  title: string;
  /** One sentence, shown under the title and beside it in the contents on a narrow screen. */
  summary: string;
  body: ReactNode;
}

/** Opens another topic of the guide, or the FAQ when given 'faq'. */
export type OpenTopic = (id: string) => void;

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
        <Text style={prose.body}>{children}</Text>
      </View>
      <View style={styles.rendererExample} aria-hidden>
        {example}
      </View>
    </View>
  );
}

// Above GUIDE_TOPICS, whose elements are built when the module loads.
const styles = StyleSheet.create({
  warning: { color: colors.warningText },
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

export const GUIDE_TOPICS: ((open: OpenTopic) => GuideTopic)[] = [
  (open) => ({
    id: 'bringing-in',
    group: 'setup',
    title: 'Bringing in your list',
    summary: 'Paste, type or drop a file - plain text, YAML or JSON.',
    body: (
      <>
        <P>
          Paste your list into the box, type it, or drop a file anywhere on the page. A <B>plain list</B> is
          one item per line. <B>YAML</B> and <B>JSON</B> can carry more about each item - an artist, a year, a
          link - and those details can then be shown while you rank.
        </P>
        <P>
          The format is detected for you. If it guesses wrong, pick <K>Plain list</K>, <K>YAML</K> or{' '}
          <K>JSON</K> under the box to read it that way instead. No list handy? The sample buttons above the
          box load ten songs, movies or Steam games, already set up to show the cards off.
        </P>
        <P>
          A YAML or JSON document can hold more than one list. When it does, the panel on the right asks which
          one to rank; the rest of the document is kept exactly as it was and comes back with your export. See{' '}
          <GuideLink onPress={() => open('several-lists')}>Several lists in one document</GuideLink>.
        </P>
      </>
    ),
  }),
  (open) => ({
    id: 'starting-order',
    group: 'setup',
    title: 'Already ranked, in no order, or sortable?',
    summary: 'Start from your existing order, a field, or from scratch.',
    body: (
      <>
        <P>
          Tell it how far to trust the order your list is already in. Items start from the position they have,
          and your answers move them from there.
        </P>
        <Bullets
          items={[
            <>
              <B>No particular order.</B> You haven&apos;t tried to rank it yet, or only very loosely. Every
              item starts even.
            </>,
            <>
              <B>Roughly best to worst.</B> You sorted it yourself. The order is a starting guess that your
              answers can move fairly easily.
            </>,
            <>
              <B>Ranked best to worst.</B> You ranked it in this app before, or put real care into it by hand.
              The order is trusted much more, so it takes more answers to move an item far from where it
              began.
            </>,
            <>
              <B>Sort by a field.</B> The list has a number or a date that says what you would put first, such
              as a rating, a play count or the year added. Pick that field and a direction (high to low or low
              to high; newest first or oldest first for dates). A field is offered when at least half the
              entries have a number or a standard date such as 2024-05-13 and the values are not all the same.
              Ties keep their order, and entries with no value start in the middle. It starts as a rough
              guess, like <B>Roughly best to worst</B>, and your answers override it.
            </>,
          ]}
        />
        <P>
          Not sure? Choose <B>Roughly best to worst</B>: trusting a list too much makes it hard to fix, and
          trusting it too little costs only a few answers. The starting order is fixed once the list is
          created, so choose with care; <K>Start over</K> is the way to begin again with a different one. See{' '}
          <GuideLink onPress={() => open('list-setup')}>List setup</GuideLink>.
        </P>
      </>
    ),
  }),
  (open) => ({
    id: 'card-fields',
    group: 'setup',
    title: 'Choosing what each card shows',
    summary: 'The title, the details under it, and their order.',
    body: (
      <>
        <P>
          For a list of objects, the <B>Fields</B> panel lists every field your items have, each with a few of
          its values so you can see what it holds. Fields on the cards are grouped at the top, in the order a
          card shows them.
        </P>
        <Bullets
          items={[
            <>
              <B>Title.</B> The first field titles each card to begin with. Tap any other field to make it the
              title instead. Lists and nested objects cannot be titles. A title is always shown as it is
              written in your data - it has no other way to be drawn.
            </>,
            <>
              <B>Details.</B> Tick the box on the left of a field to show it on every card under the title -
              as many as you like. Nothing is ticked until you tick it. The number in the box is the
              field&apos;s place on the card.
            </>,
            <>
              <B>Order.</B> Use the <K>▲</K> <K>▼</K> arrows on a ticked field to move it up or down the card.
            </>,
            <>
              <B>How it is drawn.</B> Where a field can be drawn more than one way, the <K>▾</K> button on its
              right opens the choices, each previewed with your own values. The cell then shows what you
              chose. See <GuideLink onPress={() => open('renderers')}>Ways to draw a field</GuideLink>.
            </>,
          ]}
        />
        <P>
          A count like <Text style={styles.warning}>9 of 12</Text> means only some items have that field.
          Cards for the others show a dash in its place, so the two cards in a pair always line up.
        </P>
      </>
    ),
  }),
  () => ({
    id: 'renderers',
    group: 'setup',
    title: 'Ways to draw a field',
    summary: 'Text, money, links, pictures, places, tags, dates, ratings and more.',
    body: (
      <>
        <P>
          Each way is offered only when every value the field holds suits it - a field where even one value is
          not a web address is never offered as a link. The ranked list shows each row as one line, so there
          the visual ones are written out instead: stars read <K>★ 9.2/10</K>, tags read as a list.
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
          example={
            <FieldValue
              field="released"
              value="2024-04-12"
              renderer="date"
              withKey
              textStyle={styles.exampleText}
            />
          }
        >
          <B>Date</B> writes it the way dates are written where you are. <B>Year only</B> keeps just the year
          - often all a comparison needs.
        </Renderer>
        <Renderer
          name="Duration (seconds)"
          offered="Offered when every value is a whole number of zero or more."
          example={
            <FieldValue
              field="length"
              value={171}
              renderer="duration"
              withKey
              textStyle={styles.exampleText}
            />
          }
        >
          Reads the number as seconds: 171 becomes 2:51, and 3735 becomes 1:02:15. Nothing in a plain number
          says it is seconds, so only choose it when it is.
        </Renderer>
        <Renderer
          name="Compact number"
          offered="Offered when every value is a number and at least one reaches 1,000."
          example={
            <FieldValue
              field="plays"
              value={1534000}
              renderer="compact"
              withKey
              textStyle={styles.exampleText}
            />
          }
        >
          Shortens large numbers - 1,534,000 becomes 1.5M - for play counts, populations, prices.
        </Renderer>
        <Renderer
          name="Currency"
          offered="Offered when every value is a number. Pick the currency: USD, CAD, EUR, GBP, AUD, JPY, CHF or INR."
          example={
            <FieldValue
              field="rent"
              value={2400}
              renderer="currency-CAD"
              withKey
              textStyle={styles.exampleText}
            />
          }
        >
          Writes the number as money, the way it is written where you are. Whole amounts drop the cents, so a
          salary reads $120,000 rather than $120,000.00.
        </Renderer>
        <Renderer
          name="Long text"
          offered="Offered when every value is text and at least one runs past 80 characters or over more than one line."
          example={<Text style={styles.exampleText}>notes: Close to the park, but…</Text>}
        >
          Notes, descriptions and pitches. A card shows the first three lines with a <K>More</K> button for
          the rest, which never chooses the card. The ranked list keeps it to one line.
        </Renderer>

        <Text style={styles.group}>Lists and yes-or-no</Text>
        <Renderer
          name="Tags"
          offered="Offered when every value is a list of words or numbers."
          example={
            <FieldValue
              field="genres"
              value={['Pop', 'Disco']}
              renderer="tags"
              withKey
              textStyle={styles.exampleText}
            />
          }
        >
          Each entry as its own small label, instead of the list written out in brackets. An empty list shows
          a dash.
        </Renderer>
        <Renderer
          name="Pills"
          offered="Offered when every value is a short word or phrase, at most 24 different ones, and they repeat across items - or the field is named like a category, such as genre or status."
          example={<FieldValue field="priority" value="High" renderer="pills" />}
        >
          A coloured label for categories: priority, status, cuisine, genre. The colour comes from the word
          itself, so the same word is the same colour on every card. Priorities keep the colours they mean -
          high and urgent are red, medium amber, low green.
        </Renderer>
        <Renderer
          name="Badge"
          offered="Offered when every value is true or false."
          example={<FieldValue field="explicit" value renderer="badge" />}
        >
          Shows the field&apos;s name as a label when the value is true, and nothing at all when it is false -
          quieter than a line saying false on every card.
        </Renderer>

        <Text style={styles.group}>Places and colours</Text>
        <Renderer
          name="Location"
          offered="Offered when every value is a map position - {lat, lng}, [lat, lng] or 43.65, -79.38 - or is text in a field named like a place: address, city, venue, location…"
          example={
            <FieldValue
              field="address"
              value="100 Queen St W"
              renderer="location"
              withKey
              textStyle={styles.exampleText}
            />
          }
        >
          The place as a link that opens it on a map in a new tab, without choosing the card.
        </Renderer>
        <Renderer
          name="Flag"
          offered="Offered when every value is a two-letter country code, like CA or jp."
          example={
            <FieldValue field="country" value="CA" renderer="flag" withKey textStyle={styles.exampleText} />
          }
        >
          The country&apos;s flag and its name in your language. Some systems, Windows among them, draw flags
          as the two letters instead; the name is always there.
        </Renderer>
        <Renderer
          name="Colour swatch"
          offered="Offered when every value is a colour written as #hex, rgb() or hsl()."
          example={
            <FieldValue
              field="paint"
              value="#336699"
              renderer="color-swatch"
              withKey
              textStyle={styles.exampleText}
            />
          }
        >
          A small square of the colour beside its code - for palettes, paints and brand choices.
        </Renderer>

        <Text style={styles.group}>Ratings</Text>
        <P>
          Both ask what the score is <B>out of</B>: 1, 5, 10 or 100. Only scales that every value fits under
          are offered, so a field with a 9.2 in it is never offered out of 5. Out of 1 and out of 100 read as
          percentages.
        </P>
        <Renderer
          name="Stars"
          offered="Offered when every value is a number of zero or more."
          example={<StarRating value={9.2} scale={10} size={16} />}
        >
          Always five stars, lit from the left to the score&apos;s share of the scale. 9.2 out of 10 lights
          92% of the row, so the last star is mostly grey.
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
          example={
            <FieldLink url="https://example.com/arrival" prefix="site:" textStyle={styles.exampleLink} />
          }
        >
          A link that opens in a new tab. Clicking it never chooses the card. In the ranked list, where a row
          is something you drag, it reads as plain text.
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
          A picture to the left of each comparison card&apos;s title, and a small one at the start of each row
          in the ranked list. Anything after a <K>?</K> or <K>#</K> in the address is ignored, so{' '}
          <K>…/cover.jpg?w=300</K> counts. An item whose picture is missing or will not load keeps an empty
          frame, so everything still lines up.
        </Renderer>
        <Renderer
          name="Image gallery"
          offered="Offered when every value is a list of image links, or a single one, and at least one is a list."
          example={
            <View style={styles.imageExample}>
              <FieldImage value={undefined} size={28} label="" />
              <FieldImage value={undefined} size={28} label="" />
              <FieldImage value={undefined} size={28} label="" />
            </View>
          }
        >
          Several pictures for one item - an apartment&apos;s rooms, a venue from every side. They go in the
          same place as an image, with arrows under it to page through them.
        </Renderer>
        <Renderer
          name="YouTube thumbnail"
          offered="Offered when every value is a YouTube video address - watch, youtu.be, shorts, embed or live."
          example={<FieldImage value={undefined} size={56} label="" />}
        >
          The video&apos;s own picture, in the same place an image goes, marked with a small play sign.
          Clicking it on a card opens the video in a new tab, without choosing the card.
        </Renderer>
        <Renderer
          name="Steam header"
          offered="Offered when every value is a Steam app id, like 620, or a store.steampowered.com/app/… address."
          example={<FieldImage value={undefined} size={64} aspect={460 / 215} label="" />}
        >
          The game&apos;s banner from its Steam store page, kept wide rather than cropped. Clicking it opens
          the store page. A few newer games keep their banner where it cannot be guessed from the id; those
          show an empty frame.
        </Renderer>
        <Renderer
          name="Apple Music preview"
          offered="Offered when every value is text or a number - meant for Apple Music track ids."
          example={<PreviewButtonPlaceholder />}
        >
          A round play button for a 30-second clip of the track, at the top right of each card, near the end
          of each ranked row, and on the field itself while you set up. Clips are looked up in Apple
          Music&apos;s catalogue; a track with no clip simply has no button.
        </Renderer>
        <Renderer
          name="Deezer preview"
          offered="Offered when every value is a Deezer track id or a deezer.com/track/… address."
          example={<PreviewButtonPlaceholder />}
        >
          The same play button, with the clip from Deezer&apos;s catalogue. Track ids from Apple Music and
          Deezer are both plain numbers, so a field of them is offered both - pick the catalogue the ids came
          from.
        </Renderer>
        <P>
          A card has one picture and one play button, and every field drawn as either feeds them. Pictures
          from every picture field - images, galleries, thumbnails, banners - join one gallery in the
          card&apos;s order. Clip fields line up as fallbacks: the button plays from the first in the
          card&apos;s order that has a clip, so a track missing from Apple Music can still play from Deezer.
          The ranked list shows each row&apos;s first picture.
        </P>
      </>
    ),
  }),
  (open) => ({
    id: 'comparing',
    group: 'rank',
    title: 'Answering questions',
    summary: 'Choosing, calling a tie, not knowing an item, removing, undoing - and the keyboard.',
    body: (
      <>
        <Bullets
          items={[
            <>
              <B>Choose</B> by clicking anywhere on the card you prefer.
            </>,
            <>
              <B>Much better</B> is for when it is not close. It counts for more than a plain choice.
            </>,
            <>
              <B>Can&apos;t decide</B> when the two are too close to call. It counts as a tie: a close call
              that pulls the two a little closer, though it says less than a choice does.
            </>,
            <>
              <B>Don&apos;t recognize…</B>, beside Can&apos;t decide, is for an item you do not know well
              enough to judge. It asks a follow-up: click the card you do not recognize, or choose{' '}
              <B>Don&apos;t recognize either</B>; <B>Cancel</B> backs out. The item stops being asked about
              and waits at the bottom of the ranked list under <B>Didn&apos;t recognize</B>. It stays in your
              list and your export.
            </>,
            <>
              <B>Remove</B> an item with the trash can at the bottom left of its card, or at the end of its
              row in the ranked list, then confirm. It is left out of the ranking and the export. If you just
              do not know the item, use <B>Don&apos;t recognize…</B> instead.
            </>,
            <>
              <B>Undo</B> takes back your last change: an answer, a move or a removal. A removed item comes
              back only with <K>Undo</K>.
            </>,
            <>
              <B>Show details</B> opens every field of both items, for the times the card&apos;s summary is
              not enough.
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
              <K>S</K> can&apos;t decide.
            </>,
            <>
              <K>K</K> then <K>L</K>, <K>R</K> or <K>B</K> marks the left item, the right item or both as not
              recognized; <K>Esc</K> cancels.
            </>,
            <>
              <K>D</K> then <K>L</K> or <K>R</K> removes the left or right item; <K>Enter</K> confirms and{' '}
              <K>Esc</K> keeps it.
            </>,
            <>
              <K>Ctrl</K>/<K>Cmd</K> + <K>Z</K> undoes.
            </>,
          ]}
        />
        <P>
          Which two items you are shown is not random. See{' '}
          <GuideLink onPress={() => open('how-it-works')}>How the order is worked out</GuideLink>.
        </P>
      </>
    ),
  }),
  (open) => ({
    id: 'how-it-works',
    group: 'rank',
    title: 'How the order is worked out',
    summary: 'What happens after each answer, and why the next pair is the next pair.',
    body: (
      <>
        <P>
          Behind the list, every item has a strength score. You never see it; the ranked list is simply those
          scores sorted from highest to lowest, and nothing else decides the order.
        </P>
        <P>
          After every answer, all the scores are worked out again together, from everything you have said so
          far, with a standard method for pairwise comparisons (the Bradley-Terry model). A choice says the
          winner is stronger than the loser, <K>Much better</K> says so more firmly, and{' '}
          <K>Can&apos;t decide</K> says they are close. Because it is one calculation over every answer, a few
          things follow:
        </P>
        <Bullets
          items={[
            <>
              <B>Answers add up.</B> If A beat B and B beat C, A is placed above C without ever meeting it.
            </>,
            <>
              <B>Who you beat matters.</B> Beating a strong item says more than beating a weak one.
            </>,
            <>
              <B>An item you have said little about is placed loosely.</B> It sits near the items it has been
              compared with and moves when they do. Items nobody has been asked about yet wait together in
              their original order.
            </>,
            <>
              <B>Your starting order is a starting guess.</B> <B>Ranked best to worst</B> is a strong one that
              your answers have to overcome, <B>Roughly best to worst</B> a weaker one, and{' '}
              <B>No particular order</B> starts everything even.
            </>,
          ]}
        />
        <P>
          The next question is the pair whose answer should teach the app the most - usually two items that
          are close in strength, or items it knows little about. A pair you have already answered is rarely
          asked again. An item you mark <B>Don&apos;t recognize…</B> is left out of the working until you move
          it back.
        </P>
        <P>
          The ranking is your best current order after every answer, so you can stop whenever it looks right.
          If rows move that you were not touching, that is expected; see the{' '}
          <GuideLink onPress={() => open('faq')}>questions and answers</GuideLink>.
        </P>
      </>
    ),
  }),
  () => ({
    id: 'ranked-list',
    group: 'rank',
    title: 'The ranked list',
    summary: 'Read the order, and move items by hand.',
    body: (
      <>
        <P>
          The <B>Ranked</B> tab beside the cards shows the order as it stands, updated after every answer.
        </P>
        <P>
          Drag a row by its <K>⠿</K> handle and drop it where the line shows: it goes exactly there. Its
          earlier answers stop counting, so rows it was compared with may shift a place or two. Hold it near
          the top or bottom of the list and the list scrolls, so a row can travel past what is on screen. It
          is a starting point, not a pin - later comparisons can still move it. <K>Undo</K> takes a move back.
          From the keyboard, focus the handle and press <K>Alt</K> + <K>↑</K> or <K>↓</K>, or <K>Alt</K> +{' '}
          <K>Home</K> or <K>End</K> to send it to the top or bottom.
        </P>
        <P>
          Items you marked <B>Don&apos;t recognize…</B> sit at the bottom under <B>Didn&apos;t recognize</B>,
          in the order you marked them. They cannot be reordered among themselves, and nothing can be dropped
          into that part. To bring one back, drag its row up into the ranking, or focus its handle and press{' '}
          <K>Alt</K> + <K>↑</K> to put it last in the ranking, or <K>Alt</K> + <K>Home</K> to put it first. It
          is then an ordinary item again, and answers from before you marked it stay out of the working.{' '}
          <K>Undo</K> takes back the mark or the move.
        </P>
      </>
    ),
  }),
  () => ({
    id: 'several-lists',
    group: 'rank',
    title: 'Several lists in one document',
    summary: 'Switch between them without losing progress.',
    body: (
      <>
        <P>
          When your document holds more than one list, the list name at the top of the ranking screen opens a
          switcher. Each list keeps its own progress, so you can move between them freely. <K>Configure</K>{' '}
          beside a list opens its setup, where you can change its fields.
        </P>
        <P>
          Lists you have not set up yourself follow the document&apos;s defaults. When setting up a list,{' '}
          <K>Set as default</K> makes its setup the default for the others.
        </P>
      </>
    ),
  }),
  (open) => ({
    id: 'exporting',
    group: 'keep',
    title: 'Exporting your ranking',
    summary: 'Your own document, with the list in its new order.',
    body: (
      <>
        <P>
          The <K>YAML</K>, <K>JSON</K> or <K>Plain list</K> tab beside the cards shows your own document with
          the list put in ranked order and everything else untouched. Copy it with the icon in the corner of
          the text, or use <K>Download</K>, which gives the format your data came in, or the tab you are on.
          The arrow beside it picks another format. That is your result to use elsewhere.
        </P>
        <P>
          An export holds the order but not the decisions behind it. To keep ranking later, save a session
          instead: see <GuideLink onPress={() => open('sessions')}>Saving and carrying on</GuideLink>.
        </P>
        <P>
          If your items have a field for their position, the export can also fill it in. See{' '}
          <GuideLink onPress={() => open('write-back')}>Writing the order into your data</GuideLink>.
        </P>
      </>
    ),
  }),
  () => ({
    id: 'sessions',
    group: 'keep',
    title: 'Saving and carrying on',
    summary: 'What is kept, where, and how to take it all with you in one file.',
    body: (
      <Bullets
        items={[
          <>
            <B>In this browser.</B> Your list and progress are saved here as you go, so a reload loses
            nothing. The top bar says when this is not possible.
          </>,
          <>
            <B>Session files.</B> <K>Save session</K>, beside the ranked list, puts everything in one file:
            your document, how every list is set up, and every decision, placement and removal. To carry on -
            in another browser, or months later - drop that file on the setup screen or choose it with{' '}
            <K>Choose a file</K>, and you are back where you left off. <K>Open session</K> does the same from
            the ranking screen. Opening one replaces the list you have open, so if that list has decisions
            behind it, you are asked first.
          </>,
          <>
            <B>Start over</B> clears the list from this browser. Files you exported are not affected.
          </>,
        ]}
      />
    ),
  }),
  () => ({
    id: 'list-setup',
    group: 'keep',
    title: 'List setup',
    summary: 'Change how a list is shown, switch lists, or start over.',
    body: (
      <>
        <P>
          The gear on <K>Your data</K> opens the setup screen for the list you are ranking. Your answers are
          kept.
        </P>
        <Bullets
          items={[
            <>
              <B>Card fields</B> change what each card shows and what the export fills in, not the ranking.
            </>,
            <>
              <B>Switching lists</B> works here too, when your document holds more than one.{' '}
              <K>Set as default</K> makes this list&apos;s setup the default for the others.
            </>,
            <>
              <B>The starting order</B> (and the field it was sorted by, if you chose one) is shown, but it is
              fixed once a list is created. Items cannot be added to a list being ranked, and a removed item
              comes back only with <K>Undo</K>.
            </>,
            <>
              <B>Start over</B>, on the ranking screen, is the way to rank different data: it clears the list
              from this browser and returns to the paste page. To carry on from a result, export your ranking
              first and paste that; its order makes a good starting point.
            </>,
          ]}
        />
      </>
    ),
  }),
  () => ({
    id: 'write-back',
    group: 'keep',
    title: 'Writing the order into your data',
    summary: 'Optional: fill a field with each item’s new position.',
    body: (
      <P>
        Your export is always in ranked order, so this is optional. If your items have a field for their
        position - a rank, an order - choose it under <B>Write the new order into</B> and the export rewrites
        it with 1, 2, 3 and so on, top to bottom.
      </P>
    ),
  }),
  () => ({
    id: 'privacy',
    group: 'keep',
    title: 'Privacy',
    summary: 'Your data stays in your browser.',
    body: (
      <P>
        There are no accounts and no server: your list is never uploaded. The only requests that leave your
        browser are the ones your own data asks for - pictures load from their addresses, and Apple Music
        previews look up their track ids with Apple.
      </P>
    ),
  }),
];
