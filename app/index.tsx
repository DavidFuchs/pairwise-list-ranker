import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';

import { ApplySummary } from '@/components/data/ApplySummary';
import { FoundPanel } from '@/components/data/FoundPanel';
import { SourceInput } from '@/components/data/SourceInput';
import { AppShell } from '@/components/layout/AppShell';
import { PageNav } from '@/components/layout/PageNav';
import { Button } from '@/components/ui/Button';
import { buildExport, buildExportDocument } from '@/lib/export/buildExport';
import { useSourceDraft } from '@/lib/hooks/useSourceDraft';
import type { SourceDraftSeed } from '@/lib/hooks/useSourceDraft';
import { diffImport } from '@/lib/import/diff';
import type { ImportDiff } from '@/lib/import/diff';
import { selectProgress, selectRanking } from '@/lib/state/selectors';
import { listStore, useListStore } from '@/lib/state/useListStore';
import type { DataSource } from '@/types/source';

/**
 * Every list already known this session, for the "already ranked" default -
 * the workspace's own list plus anything parked in savedLists - and the
 * document rewritten so each list's array holds its *current* ranked order,
 * not the order it was imported in. Editing your data should show what
 * ranking made of it, the same way the export tabs already do.
 */
function buildDraftSeed(): SourceDraftSeed | undefined {
  const state = listStore.getState();
  if (state.workspace === null) return undefined;

  const knownLists: Record<string, boolean> = {
    [state.workspace.source.arrayPath.join('.')]: state.workspace.alreadyRanked,
  };

  let document = state.workspace.source.document;
  for (const list of state.savedLists) {
    knownLists[list.arrayPath.join('.')] = list.alreadyRanked;
    const ranking = selectRanking(list.items, list.comparisonEvents, list.alreadyRanked);
    document = buildExportDocument(
      { format: state.workspace.source.format, rawText: '', document, arrayPath: list.arrayPath },
      list.roles,
      ranking.map((entry) => entry.item.value),
    );
  }

  const activeRanking = selectRanking(state.items, state.comparisonEvents, state.workspace.alreadyRanked);
  const sourceWithCurrentOrder: DataSource = { ...state.workspace.source, document };
  const rawText = buildExport(
    sourceWithCurrentOrder,
    state.workspace.roles,
    activeRanking.map((entry) => entry.item),
    state.workspace.source.format,
  );

  return {
    rawText,
    arrayPath: state.workspace.source.arrayPath,
    roles: state.workspace.roles,
    alreadyRanked: state.workspace.alreadyRanked,
    knownLists,
  };
}

export default function DataScreen() {
  const router = useRouter();
  const workspace = useListStore((state) => state.workspace);
  const items = useListStore((state) => state.items);
  const comparisonEvents = useListStore((state) => state.comparisonEvents);
  const savedLists = useListStore((state) => state.savedLists);
  const hydrated = useListStore((state) => state.hydrated);
  const resumed = useListStore((state) => state.resumed);

  // Read once, on the first render after hydration: re-seeding on every
  // keystroke would fight the user's typing.
  const seed = useMemo(() => buildDraftSeed(), []);

  const draft = useSourceDraft(seed);
  const [pending, setPending] = useState<ImportDiff | null>(null);

  useEffect(() => {
    listStore.getState().hydrate();
  }, []);

  // A saved workspace resumes straight into ranking, but only once, so that
  // navigating back here from the rank screen does not bounce.
  useEffect(() => {
    if (!hydrated || resumed) return;
    listStore.getState().markResumed();
    if (workspace !== null) router.replace('/rank');
  }, [hydrated, resumed, workspace, router]);

  const editing = workspace !== null;
  // An empty box isn't a parse error, so neither panel should treat it as one.
  const rawTextIsBlank = draft.rawText.trim() === '';
  const isSwitchingList =
    workspace !== null &&
    draft.selectedPath !== null &&
    workspace.source.arrayPath.join('.') !== draft.selectedPath.join('.');

  // Every list that already has a ranking percent earns a meter, whether that
  // came from real comparisons, from being declared already ranked, or both -
  // and whether it is the one currently active or one parked in savedLists
  // while another list is being worked on.
  const rankedCoverages = useMemo(() => {
    const coverages: Record<string, number> = {};

    for (const list of savedLists) {
      const listProgress = selectProgress(list.items, list.comparisonEvents, list.alreadyRanked);
      if (listProgress.coverage === 0) continue;
      coverages[list.arrayPath.join('.')] = listProgress.coverage;
    }

    if (workspace !== null) {
      const activeProgress = selectProgress(items, comparisonEvents, workspace.alreadyRanked);
      if (activeProgress.coverage > 0) {
        coverages[workspace.source.arrayPath.join('.')] = activeProgress.coverage;
      }
    }

    return coverages;
  }, [savedLists, workspace, items, comparisonEvents]);

  // The order control shows "best to worst" whenever the selected list
  // already has a ranking percent, even if that came from real comparisons
  // rather than an explicit declaration - matching the meter right next to
  // it. This is display only: submitting without touching the control still
  // sends draft.alreadyRanked (the list's real, safe answer), never this
  // cosmetic guess, so an already-ranked-by-comparisons list is never
  // silently reseeded from scratch.
  const selectedPathKey = draft.selectedPath === null ? null : draft.selectedPath.join('.');
  const selectedCoverage = selectedPathKey === null ? 0 : (rankedCoverages[selectedPathKey] ?? 0);
  const orderPickerValue = draft.alreadyRankedIsExplicit ? draft.alreadyRanked : selectedCoverage > 0;

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
    if (previousPath.join('.') !== source.arrayPath.join('.')) {
      listStore
        .getState()
        .switchList({ source, roles: draft.roles, alreadyRanked: draft.alreadyRanked });
      router.replace('/rank');
      return;
    }

    setPending(diffImport(current.items, draft.entries, current.comparisonEvents));
  }

  function handleConfirm() {
    const source = draft.toSource();
    if (source === null) return;
    listStore
      .getState()
      .applyEdits({ source, roles: draft.roles, alreadyRanked: draft.alreadyRanked });
    setPending(null);
    router.replace('/rank');
  }

  return (
    <AppShell
      listName={editing ? 'Editing your data' : 'New list'}
      statusText={editing ? 'Editing your data' : 'Nothing saved yet'}
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
          <SourceInput
            value={draft.rawText}
            onChange={(text) => {
              setPending(null);
              draft.setRawText(text);
            }}
            override={draft.override}
            onOverrideChange={draft.setOverride}
            format={draft.analysis.format}
            issues={rawTextIsBlank ? [] : draft.analysis.issues}
            availableOverrides={draft.availableOverrides}
          />
        </>
      }
      preview={
        pending === null ? (
          <FoundPanel
            analysis={rawTextIsBlank ? { ...draft.analysis, issues: [] } : draft.analysis}
            selectedPath={draft.selectedPath}
            roles={draft.roles}
            alreadyRanked={orderPickerValue}
            entries={draft.entries}
            isBlank={rawTextIsBlank}
            ctaLabel={isSwitchingList ? 'Switch list' : editing ? 'Apply edits' : 'Start ranking'}
            rankedCoverages={rankedCoverages}
            onSelectPath={draft.selectPath}
            onRolesChange={draft.setRoles}
            onAlreadyRankedChange={draft.setAlreadyRanked}
            onSubmit={handleSubmit}
          />
        ) : (
          <ApplySummary
            diff={pending}
            onCancel={() => setPending(null)}
            onConfirm={handleConfirm}
          />
        )
      }
    />
  );
}
