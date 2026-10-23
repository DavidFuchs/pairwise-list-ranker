import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { B, Bullets, GuideLink, K, P } from '@/components/layout/GuideProse';
import { colors, fonts, space } from '@/lib/theme';

export interface GuideFaqProps {
  /** Opens a topic of the full guide. */
  onOpenTopic: (topicId: string) => void;
}

interface Question {
  question: string;
  answer: ReactNode;
}

/**
 * Plain questions with their answers in the open, rather than folded away:
 * the whole list is short enough to read down, and the first question is the
 * one people most often arrive with.
 */
export function GuideFaq({ onOpenTopic }: GuideFaqProps) {
  const questions = questionsFor(onOpenTopic);

  return (
    <View style={styles.list}>
      {questions.map(({ question, answer }) => (
        <View key={question} style={styles.item}>
          <Text role="heading" aria-level={3} style={styles.question}>
            {question}
          </Text>
          <View style={styles.answer}>{answer}</View>
        </View>
      ))}
    </View>
  );
}

function questionsFor(open: (topicId: string) => void): Question[] {
  return [
    {
      question: 'Why did items move that I was not comparing?',
      answer: (
        <>
          <P>
            Every answer re-works the whole ranking, not only the two cards in front of you. The order is
            worked out from all your answers together, so one answer can reach items you never touched. Three
            things cause most of it:
          </P>
          <Bullets
            items={[
              <>
                <B>Items follow their partners.</B> An item you have only compared once is placed by that one
                comparison. When the item it was compared with moves, it moves too, and two such items can
                swap places because their partners did.
              </>,
              <>
                <B>Items nobody has been asked about wait together.</B> They hold their original order. When
                other items move up or down out of their midst, the ones left behind shift to fill the gap.
              </>,
              <>
                <B>Close items swap easily.</B> Two items that are nearly level can trade places on a very
                small change.
              </>,
            ]}
          />
          <P>
            Nothing is wrong and nothing is lost: the list is showing its best guess, and the rows near the
            bottom of a young ranking are the loosest. It calms down as each item gets compared a few times.
            See <GuideLink onPress={() => open('how-it-works')}>How the order is worked out</GuideLink>.
          </P>
        </>
      ),
    },
    {
      question: 'How many answers will it take?',
      answer: (
        <P>
          It depends on the list and on how decisive you are. A short list, ten items or so, is usually in
          order after a few dozen answers. Longer lists need more. There is no finish line: the ranking is
          your best current order after every answer, so stop whenever it looks right to you.
        </P>
      ),
    },
    {
      question: 'Do I have to answer every question?',
      answer: (
        <P>
          No. Use <K>Can&apos;t decide</K> when you are torn, <K>Don&apos;t recognize…</K> for an item you do
          not know, remove an item you do not want ranked, or just stop. Nothing is lost by stopping, and your
          progress is saved in this browser.
        </P>
      ),
    },
    {
      question: 'What is the difference between Don’t recognize… and Remove?',
      answer: (
        <>
          <P>
            <K>Don&apos;t recognize…</K> is for an item you do not know well enough to judge. It stops being
            asked about and waits at the bottom of the ranked list under <B>Didn&apos;t recognize</B>. It
            stays in your list and your export, and you can drag its row back up into the ranking later. If
            you use it on a pair, it asks which one: click a card, or choose{' '}
            <B>Don&apos;t recognize either</B>. From the keyboard, press <K>K</K> then <K>L</K>, <K>R</K> or{' '}
            <K>B</K>.
          </P>
          <P>
            Remove takes an item out of the ranking and the export altogether, for an item you do not want at
            all. Both can be undone.
          </P>
        </>
      ),
    },
    {
      question: 'What is the difference between a choice, Much better and Can’t decide?',
      answer: (
        <P>
          A choice says one item is better. <K>Much better</K> says so more firmly, and counts for more when
          the order is worked out. <K>Can&apos;t decide</K> says the two are close: it pulls them a little
          nearer together, though it says less than a choice does.
        </P>
      ),
    },
    {
      question: 'I made a mistake. Can I take an answer back?',
      answer: (
        <P>
          Yes. <K>Undo</K> takes back your last change, and so does <K>Ctrl</K>/<K>Cmd</K> + <K>Z</K>. It
          steps back one at a time, including a row you dragged, a removal and a whole edit.
        </P>
      ),
    },
    {
      question: 'Why am I shown a pair I already answered?',
      answer: (
        <P>
          The next question is the one expected to teach the app the most, and sometimes that is a pair you
          have seen. A pair is much less likely to come up again each time it has been asked, and the app
          never asks the same pair twice in a row.
        </P>
      ),
    },
    {
      question: 'I dragged an item to the top and it moved again. Why?',
      answer: (
        <P>
          A drag is a strong starting point, not a pin. It goes exactly where you drop it, but later answers
          can still shift it if they disagree.{' '}
          <GuideLink onPress={() => open('ranked-list')}>The ranked list</GuideLink> has the details.
        </P>
      ),
    },
    {
      question: 'Can I start from an order I already have?',
      answer: (
        <P>
          Yes. When you set up the list, choose <B>Roughly best to worst</B> if you sorted it yourself, or{' '}
          <B>Ranked best to worst</B> if you ranked it in this app before or put real care into it by hand.
          The ranking starts from your order and refines it. See{' '}
          <GuideLink onPress={() => open('starting-order')}>
            Already ranked, in no order, or sortable?
          </GuideLink>
        </P>
      ),
    },
    {
      question: 'Can I add items after I have started?',
      answer: (
        <P>
          No. Items cannot be added to a list being ranked, and its starting order is fixed. To rank different
          data, use <K>Start over</K> and paste the new list. Starting again from your exported ranking works
          well: its order is a good starting point. See{' '}
          <GuideLink onPress={() => open('list-setup')}>List setup</GuideLink>.
        </P>
      ),
    },
    {
      question: 'Will I lose my progress if I close the tab?',
      answer: (
        <P>
          No. Your list and answers are kept in this browser as you go. Clearing the browser&apos;s site data
          removes them, and another browser or device will not have them, so use <K>Save session</K> to keep a
          copy in a file. See <GuideLink onPress={() => open('sessions')}>Saving and carrying on</GuideLink>.
        </P>
      ),
    },
    {
      question: 'Is my list uploaded anywhere?',
      answer: (
        <P>
          No. There are no accounts and no server. See{' '}
          <GuideLink onPress={() => open('privacy')}>Privacy</GuideLink>.
        </P>
      ),
    },
  ];
}

const styles = StyleSheet.create({
  list: { gap: space.lg },
  item: {
    gap: space.sm,
    paddingBottom: space.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  question: {
    fontFamily: fonts.heading,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  answer: { gap: space.sm },
});
