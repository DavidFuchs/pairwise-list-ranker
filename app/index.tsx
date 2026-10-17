import { useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ApplySummary } from '@/components/data/ApplySummary';
import { CardPreview } from '@/components/data/CardPreview';
import { FileNotice } from '@/components/data/FileNotice';
import type { FileNoticeState } from '@/components/data/FileNotice';
import { FoundPanel } from '@/components/data/FoundPanel';
import { StartCta } from '@/components/data/StartCta';
import { SourceInput } from '@/components/data/SourceInput';
import { AppShell } from '@/components/layout/AppShell';
import { PageNav } from '@/components/layout/PageNav';
import { Button } from '@/components/ui/Button';
import { useSourceDraft } from '@/lib/hooks/useSourceDraft';
import { diffImport, diffSettings } from '@/lib/import/diff';
import { pathKey, samePath } from '@/lib/import/paths';
import { readTextFile } from '@/lib/browser/fileText';
import { describeReadiness } from '@/lib/import/readiness';
import { isPlainObject } from '@/lib/import/shape';
import type { ImportDiff, SettingsDiff } from '@/lib/import/diff';
import { buildDraftSeed, selectConfigLines, selectRankedCoverages } from '@/lib/state/draft';
import { activeList } from '@/lib/state/lists';
import { selectRanking } from '@/lib/state/selectors';
import { confirmOpenSession, hasDecisions, readSavedFile } from '@/lib/session/sessionFile';
import { listStore, useListStore } from '@/lib/state/useListStore';
import type { ItemValue } from '@/types/list';
import { space } from '@/lib/theme';

/** The narrowest the card preview gets beside the editor. */
const PREVIEW_MIN_WIDTH = 400;
/** The narrowest the editor gets before the preview moves below it. */
const EDITOR_MIN_WIDTH = 420;

export default function DataScreen() {
  const router = useRouter();
  const workspace = useListStore((state) => state.workspace);
  const hydrated = useListStore((state) => state.hydrated);
  const resumed = useListStore((state) => state.resumed);

  // Read once, on the first render after hydration: re-seeding on every
  // keystroke would fight the user's typing.
  const seed = useMemo(() => buildDraftSeed(listStore.getState()), []);

  const draft = useSourceDraft(seed);
  // Both halves of what one press of Apply edits would do: what it does to
  // the entries, and what it does to how they are ranked.
  const [pending, setPending] = useState<{
    diff: ImportDiff;
    settings: SettingsDiff;
  } | null>(null);
  const [fileNotice, setFileNotice] = useState<FileNoticeState | null>(null);
  const [workWidth, setWorkWidth] = useState(0);

  useEffect(() => {
    listStore.getState().hydrate();
  }, []);

  /**
   * A chosen or dropped file is either one of this app's own - a session to
   * pick up where it left off - or a list to import.
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
        setPending(null);
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

    const open = () => {
      setFileNotice(null);
      listStore.getState().loadSession(saved.session);
      router.replace('/rank');
    };
    if (hasDecisions(listStore.getState().workspace)) {
      setFileNotice({ confirm: confirmOpenSession(saved.session), onConfirm: open });
    } else {
      open();
    }
  }

  // The list switcher's preselection is only meant for the render that reads
  // it into the seed above - clearing it here keeps a later, ordinary visit
  // to this screen from preselecting a stale list.
  useEffect(() => {
    listStore.getState().clearPendingSwitch();
  }, []);

  // A saved workspace resumes straight into ranking, but only once, so that
  // navigating back here from the rank screen does not bounce.
  useEffect(() => {
    if (!hydrated || resumed) return;
    listStore.getState().markResumed();
    if (workspace !== null) router.replace('/rank');
  }, [hydrated, resumed, workspace, router]);

  const editing = workspace !== null;
  // Only objects have fields to set up, so only they get a card preview.
  // What the card preview can draw: objects with their fields, plain items as
  // their text. Anything else (a nested list) has no card to show.
  const previewEntries = useMemo(
    () =>
      draft.entries.filter(
        (entry): entry is ItemValue =>
          isPlainObject(entry) || ['string', 'number', 'boolean'].includes(typeof entry),
      ),
    [draft.entries],
  );
  // An empty box isn't a parse error, so neither panel should treat it as one.
  const rawTextIsBlank = draft.rawText.trim() === '';
  const wide = workWidth >= EDITOR_MIN_WIDTH + PREVIEW_MIN_WIDTH + space.lg;
  // Held from the start on a wide screen, as a placeholder until there is a
  // list, so the editor does not narrow the moment one arrives.
  const showPreview = pending === null && (rawTextIsBlank ? wide : previewEntries.length > 0);
  const sideBySide = showPreview && wide;
  // A third of the area beside it, so cards read about as wide as one of a
  // pair on the rank screen, and never narrower than the minimum.
  const previewWidth = Math.max(PREVIEW_MIN_WIDTH, Math.round(workWidth / 3));
  const isSwitchingList =
    workspace !== null &&
    draft.selectedPath !== null &&
    !samePath(workspace.source.arrayPath, draft.selectedPath);

  const rankedCoverages = useMemo(() => selectRankedCoverages(workspace), [workspace]);

  // The order control shows "best to worst" whenever the selected list
  // already has a ranking percent, even if that came from real comparisons
  // rather than an explicit declaration - matching the meter right next to
  // it. This is display only: submitting without touching the control still
  // sends draft.alreadyRanked (the list's real, safe answer), never this
  // cosmetic guess, so an already-ranked-by-comparisons list is never
  // silently reseeded from scratch.
  const selectedPathKey = draft.selectedPath === null ? null : pathKey(draft.selectedPath);
  // Only lists with a reading at all are in the map, so having one is itself
  // the "already has a ranking percent" test.
  const selectedCoverage = selectedPathKey === null ? undefined : rankedCoverages[selectedPathKey];
  const orderPickerValue = draft.alreadyRankedIsExplicit
    ? draft.alreadyRanked
    : selectedCoverage !== undefined;

  // Whether the controls on screen already say what every list not set up by
  // hand follows, which decides both halves of the Set as default control.
  const settingsAreDefault =
    workspace !== null &&
    !diffSettings(workspace.listDefaults, { roles: draft.roles, alreadyRanked: orderPickerValue }).changed;

  const configLines = useMemo(
    () =>
      selectConfigLines(
        workspace,
        draft.analysis.document,
        draft.analysis.candidates,
        draft.selectedPath === null
          ? null
          : { path: draft.selectedPath, roles: draft.roles, alreadyRanked: orderPickerValue },
      ),
    [
      workspace,
      draft.analysis.document,
      draft.analysis.candidates,
      draft.selectedPath,
      draft.roles,
      orderPickerValue,
    ],
  );

  // An empty box is not a parse error, so it reports no issues.
  const foundAnalysis = rawTextIsBlank ? { ...draft.analysis, issues: [] } : draft.analysis;
  const ctaLabel = isSwitchingList ? 'Switch list' : editing ? 'Apply edits' : 'Start ranking';
  // The same readiness FoundPanel shows, for the docked copy of its button.
  const readiness = describeReadiness({
    candidates: foundAnalysis.candidates,
    selectedPath: draft.selectedPath,
    entries: draft.entries,
    roles: draft.roles,
    hasIssues: foundAnalysis.issues.length > 0,
    isBlank: rawTextIsBlank,
  });

  function handleSubmit() {
    const source = draft.toSource();
    if (source === null) return;

    if (!editing) {
      listStore.getState().startRanking({
        source,
        roles: draft.roles,
        alreadyRanked: draft.alreadyRanked,
      });
      router.replace('/rank');
      return;
    }

    const current = listStore.getState();
    const previousPath = current.workspace!.source.arrayPath;

    // A different list is not an edit to this one, and nothing about it is
    // destructive - each list's ranking is kept and restored when you come
    // back to it - so it applies immediately instead of asking to confirm.
    if (!samePath(previousPath, source.arrayPath)) {
      listStore.getState().switchList({
        source,
        roles: draft.roles,
        alreadyRanked: draft.alreadyRanked,
      });
      router.replace('/rank');
      return;
    }

    const list = activeList(current.workspace!);
    const workspaceConfig = { roles: list.roles, alreadyRanked: list.alreadyRanked };

    // Diffed against the order the text box was filled with - the ranking's
    // own order - not the order the entries were imported in. Otherwise every
    // list a comparison has moved reports an order change the user never made.
    const shownOrder = selectRanking(list.items, list.comparisonEvents, list.alreadyRanked).map(
      (entry) => entry.item,
    );

    setPending({
      diff: diffImport(shownOrder, draft.entries, list.comparisonEvents),
      // Compared against what submitting actually applies below, which is the
      // draft's own answer rather than the order control's cosmetic guess.
      settings: diffSettings(workspaceConfig, {
        roles: draft.roles,
        alreadyRanked: draft.alreadyRanked,
      }),
    });
  }

  function handleConfirm() {
    const source = draft.toSource();
    if (source === null) return;
    listStore.getState().applyEdits({
      source,
      roles: draft.roles,
      alreadyRanked: draft.alreadyRanked,
    });
    setPending(null);
    router.replace('/rank');
  }

  return (
    <>
      <Head>
        <title>{editing ? 'Pairwise: edit data' : 'Pairwise: add a list'}</title>
      </Head>
      <AppShell
        onFileDrop={openFile}
        // Reviewing an edit has its own buttons; the dock is for getting there.
        dock={
          pending === null ? (
            <StartCta
              label={ctaLabel}
              reason={readiness.reason}
              ready={readiness.ready}
              onSubmit={handleSubmit}
            />
          ) : undefined
        }
        stage={
          <>
            {editing && (
              <PageNav>
                <Button
                  label="Back to ranking ›"
                  accessibilityLabel="Back to ranking"
                  variant="secondary"
                  size="sm"
                  onPress={() => router.replace('/rank')}
                />
              </PageNav>
            )}
            {/* The preview sits beside the editor while there is room, so the
              card stays in view while the fields are set in the sidebar and
              the editor keeps the column's full height. */}
            <View
              style={[styles.work, sideBySide && styles.workRow]}
              onLayout={(event) => setWorkWidth(event.nativeEvent.layout.width)}
            >
              <SourceInput
                value={draft.rawText}
                onChange={(text) => {
                  setPending(null);
                  draft.setRawText(text);
                }}
                onFile={openFile}
                onSample={(sample) => {
                  setPending(null);
                  setFileNotice(null);
                  // Detected, not pinned: a format tab left on Plain list
                  // would otherwise misread the sample.
                  draft.setOverride('auto');
                  // Each sample arrives set up to show the renderers off.
                  draft.loadPreset(sample.text, sample.path, sample.roles);
                }}
                override={draft.override}
                onOverrideChange={draft.setOverride}
                format={draft.analysis.format}
                issues={rawTextIsBlank ? [] : draft.analysis.issues}
                availableOverrides={draft.availableOverrides}
              />
              {showPreview && (
                <View style={sideBySide ? [styles.previewBeside, { width: previewWidth }] : undefined}>
                  <CardPreview
                    entries={rawTextIsBlank ? [] : previewEntries}
                    roles={draft.roles}
                    fill={sideBySide}
                  />
                </View>
              )}
            </View>
            {fileNotice !== null && <FileNotice notice={fileNotice} onDismiss={() => setFileNotice(null)} />}
          </>
        }
        preview={
          pending === null ? (
            <FoundPanel
              analysis={foundAnalysis}
              selectedPath={draft.selectedPath}
              roles={draft.roles}
              alreadyRanked={orderPickerValue}
              isDefault={settingsAreDefault}
              entries={draft.entries}
              isBlank={rawTextIsBlank}
              ctaLabel={ctaLabel}
              rankedCoverages={rankedCoverages}
              configLines={configLines}
              onSelectPath={draft.selectPath}
              onRolesChange={draft.setRoles}
              onAlreadyRankedChange={draft.setAlreadyRanked}
              // The first list a document gets defines the defaults on its own,
              // so there is nothing to set until there is one to change.
              onSetAsDefault={
                editing
                  ? () =>
                      listStore.getState().setListDefaults({
                        roles: draft.roles,
                        alreadyRanked: orderPickerValue,
                      })
                  : undefined
              }
              onSubmit={handleSubmit}
            />
          ) : (
            <ApplySummary
              diff={pending.diff}
              settings={pending.settings}
              onCancel={() => setPending(null)}
              onConfirm={handleConfirm}
            />
          )
        }
      />
    </>
  );
}

const styles = StyleSheet.create({
  // Fills the stage below the page nav, so the editor can take the height.
  work: { flex: 1, gap: space.lg },
  workRow: { flexDirection: 'row' },
  // As tall as the editor, so it can show as many cards as that height fits.
  previewBeside: { flexShrink: 0 },
});
