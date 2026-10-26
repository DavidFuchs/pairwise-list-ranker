import { useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { FileNotice } from '@/components/data/FileNotice';
import type { FileNoticeState } from '@/components/data/FileNotice';
import { SourceInput } from '@/components/data/SourceInput';
import { StartCta } from '@/components/data/StartCta';
import { AppShell, useShellDocking } from '@/components/layout/AppShell';
import { useScreenFocused } from '@/lib/hooks/useScreenFocused';
import { useSourceDraft } from '@/lib/hooks/useSourceDraft';
import { readTextFile } from '@/lib/browser/fileText';
import { MIN_RANKABLE } from '@/lib/import/arrayCandidates';
import type { ArrayCandidate } from '@/lib/import/arrayCandidates';
import { readSavedFile } from '@/lib/session/sessionFile';
import { pasteSeed } from '@/lib/state/draft';
import { pasteDraft } from '@/lib/state/pasteDraft';
import { listStore, useListStore } from '@/lib/state/useListStore';
import { colors, fonts, radius, space, typeScale } from '@/lib/theme';
import type { SourceFormat } from '@/types/source';

/** Whether the text holds a list worth ranking, and if not, the next thing to do. */
function continueState(
  blank: boolean,
  issueCount: number,
  counts: number[],
): { ready: boolean; reason?: string } {
  if (blank) return { ready: false, reason: 'Paste, type, or drop your list to get started.' };
  if (issueCount > 0) return { ready: false, reason: 'Fix the errors above to continue.' };
  if (counts.length === 0) {
    return {
      ready: false,
      reason: 'No list to rank was found. Try another format, or paste one item per line.',
    };
  }
  if (!counts.some((count) => count >= MIN_RANKABLE)) {
    return { ready: false, reason: 'A ranking needs at least two items.' };
  }
  return { ready: true };
}

const FORMAT_NAMES: Record<SourceFormat, string> = {
  list: 'Plain list',
  yaml: 'YAML',
  json: 'JSON',
};

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

/** What was found in the text: its format, and each list with its item count. */
function ListDetails({ format, candidates }: { format: SourceFormat; candidates: ArrayCandidate[] }) {
  const total = candidates.reduce((sum, candidate) => sum + candidate.count, 0);
  return (
    <View style={styles.details}>
      <View style={styles.row}>
        <Text style={styles.label}>Format</Text>
        <Text style={styles.value}>{FORMAT_NAMES[format]}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Lists found</Text>
        <Text style={styles.value}>{candidates.length}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Items</Text>
        <Text style={styles.value}>{total}</Text>
      </View>
      {candidates.length > 1 &&
        candidates.map((candidate) => (
          <View key={candidate.path.join('.')} style={styles.row}>
            <Text style={styles.listName} numberOfLines={1}>
              {candidate.path.join(' / ') || 'List'}
            </Text>
            <Text style={styles.listCount}>{plural(candidate.count, 'item')}</Text>
          </View>
        ))}
    </View>
  );
}

/** The sidebar's copy of the way forward; the dock holds it on a narrow screen. */
function ContinuePanel({
  reason,
  ready,
  onSubmit,
  details,
}: {
  reason?: string;
  ready: boolean;
  onSubmit: () => void;
  details: { format: SourceFormat; candidates: ArrayCandidate[] } | null;
}) {
  const docked = useShellDocking();
  if (docked) return null;
  return (
    <View style={styles.panel} dataSet={{ surface: 'panel' }}>
      <Text style={styles.panelTitle}>Your list</Text>
      {details === null ? (
        <Text style={styles.empty}>Nothing to read yet.</Text>
      ) : (
        <ListDetails format={details.format} candidates={details.candidates} />
      )}
      <StartCta label="Continue" reason={reason} ready={ready} onSubmit={onSubmit} />
    </View>
  );
}

/** The first screen: only the text of the list. Everything after that is setup. */
export default function PasteScreen() {
  const router = useRouter();
  const workspace = useListStore((state) => state.workspace);
  const hydrated = useListStore((state) => state.hydrated);

  // Read once: the draft below writes back to the store as the text changes.
  const seed = useMemo(() => pasteSeed(pasteDraft.getState()), []);
  const draft = useSourceDraft(seed);
  const [fileNotice, setFileNotice] = useState<FileNoticeState | null>(null);

  useEffect(() => {
    listStore.getState().hydrate();
  }, []);

  // A list already being ranked is where the user belongs, not here. Only
  // from the front: a page kept mounted behind another must not replace it.
  const focused = useScreenFocused();
  useEffect(() => {
    if (focused && hydrated && workspace !== null) router.replace('/rank');
  }, [focused, hydrated, workspace, router]);

  // The paste draft mirrors the text and its format, so going back from setup
  // keeps the text; the setup choices are not kept, and are made afresh.
  // A sample's own list and fields (the preset) survive until the text is
  // changed by hand.
  useEffect(() => {
    const stored = pasteDraft.getState();
    if (stored.rawText !== draft.rawText) {
      pasteDraft.setState({ rawText: draft.rawText, override: draft.override, preset: null });
    } else if (stored.override !== draft.override) {
      pasteDraft.setState({ override: draft.override });
    }
  }, [draft.rawText, draft.override]);

  /**
   * A chosen or dropped file is either one of this app's own - a session to
   * pick up where it left off - or a list to read into the text box.
   */
  async function openFile(file: File) {
    const read = await readTextFile(file);
    if ('refused' in read) {
      setFileNotice({ message: read.refused });
      return;
    }
    const { name, text } = read;
    const saved = readSavedFile(text);
    if (saved.type === 'other') {
      const replace = () => {
        setFileNotice(null);
        draft.setRawText(text);
      };
      // A drop is easily a mistake, and the text box is the user's work: say
      // what would be replaced before replacing it.
      if (draft.rawText.trim() === '' || draft.rawText === text) {
        replace();
      } else {
        setFileNotice({
          confirm: `Replace the text in the box with "${name}"? What is there now is not kept.`,
          confirmLabel: 'Replace',
          confirmAccessibilityLabel: `Replace the text with ${name}`,
          onConfirm: replace,
        });
      }
      return;
    }
    if (saved.type === 'unreadable') {
      setFileNotice({ message: saved.reason });
      return;
    }

    // A workspace never shows this page (it goes to the ranking), so there is
    // nothing here to lose by opening the session.
    setFileNotice(null);
    listStore.getState().loadSession(saved.session);
    // A session is a list already set up, so the text left in the box is not wanted next time.
    pasteDraft.getState().clear();
    router.replace('/rank');
  }

  // An empty box is not a parse error, so it reports no issues.
  const rawTextIsBlank = draft.rawText.trim() === '';
  const issues = rawTextIsBlank ? [] : draft.analysis.issues;
  const next = continueState(
    rawTextIsBlank,
    issues.length,
    draft.analysis.candidates.map((candidate) => candidate.count),
  );

  function handleContinue() {
    if (!next.ready) return;
    router.push('/setup');
  }

  return (
    <>
      <Head>
        <title>Pairwise: add a list</title>
      </Head>
      <AppShell
        onFileDrop={openFile}
        dock={<StartCta label="Continue" reason={next.reason} ready={next.ready} onSubmit={handleContinue} />}
        stage={
          <>
            <View style={styles.work}>
              <SourceInput
                value={draft.rawText}
                onChange={draft.setRawText}
                onFile={openFile}
                onSample={(sample) => {
                  setFileNotice(null);
                  // Detected, not pinned: a format tab left on Plain list
                  // would otherwise misread the sample.
                  draft.setOverride('auto');
                  // Each sample arrives set up to show the renderers off.
                  draft.loadPreset(sample.text, sample.path, sample.roles);
                  pasteDraft.getState().loadPreset(sample.text, {
                    path: sample.path,
                    siblingPaths: sample.siblingPaths,
                    roles: sample.roles,
                  });
                }}
                override={draft.override}
                onOverrideChange={draft.setOverride}
                issues={issues}
                availableOverrides={draft.availableOverrides}
              />
            </View>
            {fileNotice !== null && <FileNotice notice={fileNotice} onDismiss={() => setFileNotice(null)} />}
          </>
        }
        preview={
          <ContinuePanel
            reason={next.reason}
            ready={next.ready}
            onSubmit={handleContinue}
            details={
              rawTextIsBlank || issues.length > 0
                ? null
                : { format: draft.analysis.format, candidates: draft.analysis.candidates }
            }
          />
        }
      />
    </>
  );
}

const styles = StyleSheet.create({
  work: { flex: 1, gap: space.lg },
  panel: {
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  details: { gap: space.xs },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: space.sm },
  label: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary },
  value: { fontFamily: fonts.body, fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  listName: { flexShrink: 1, fontFamily: fonts.body, fontSize: 12, color: colors.textFaint },
  listCount: { fontFamily: fonts.body, fontSize: 12, color: colors.textFaint },
  empty: { fontFamily: fonts.body, fontSize: 13, color: colors.textFaint },
  panelTitle: {
    ...typeScale.sectionTitle,
    fontFamily: fonts.heading,
    fontWeight: '600',
    color: colors.textPrimary,
  },
});
