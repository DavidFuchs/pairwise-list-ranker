import { useLocalSearchParams, useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { pairStacks } from '@/components/comparison/ComparisonDeck';
import { CardPreview } from '@/components/data/CardPreview';
import { FoundPanel } from '@/components/data/FoundPanel';
import { StartCta } from '@/components/data/StartCta';
import { AppShell } from '@/components/layout/AppShell';
import { useSourceDraft } from '@/lib/hooks/useSourceDraft';
import { describeReadiness } from '@/lib/import/readiness';
import { isPlainObject } from '@/lib/import/shape';
import { pathFromKey, samePath } from '@/lib/import/paths';
import { orderBySortField } from '@/lib/import/sortField';
import {
  buildSetupSeed,
  pasteSeed,
  sameRoles,
  selectAnswerCounts,
  selectConfigLines,
} from '@/lib/state/draft';
import { activeList, listAt } from '@/lib/state/lists';
import { pasteDraft } from '@/lib/state/pasteDraft';
import { selectListConfig } from '@/lib/state/selectors';
import { listStore, useListStore } from '@/lib/state/useListStore';
import { cardLayout } from '@/lib/renderers';
import type { ItemValue } from '@/types/list';

type SetupMode = 'new' | 'existing';

/**
 * Sets up a list: which list, which fields, how it is ordered. For text just
 * pasted it starts the ranking; for a list already being ranked (the gear, or
 * Configure in the list switcher) it changes how that list is shown.
 */
export default function SetupScreen() {
  const hydrated = useListStore((state) => state.hydrated);

  useEffect(() => {
    listStore.getState().hydrate();
  }, []);

  // Which list is saved is not known until then.
  return hydrated ? <SetupEntry /> : null;
}

/** Settles what kind of setup this is, from what is saved and pasted when it first appears. */
function SetupEntry() {
  const router = useRouter();
  const workspace = useListStore((state) => state.workspace);
  const { path } = useLocalSearchParams<{ path?: string }>();

  // Kept: starting a ranking from here makes a workspace and empties the paste
  // draft, which must not turn this screen into another kind on its way out.
  const [entry] = useState<{ mode: SetupMode; hasText: boolean }>(() => ({
    mode: listStore.getState().workspace !== null ? 'existing' : 'new',
    hasText: pasteDraft.getState().rawText.trim() !== '',
  }));
  const { mode, hasText } = entry;

  // With nothing pasted and nothing ranked there is nothing to set up.
  const nothingToSetUp = (mode === 'new' && !hasText) || (mode === 'existing' && workspace === null);
  useEffect(() => {
    if (nothingToSetUp) router.replace('/');
  }, [nothingToSetUp, router]);

  if (nothingToSetUp) return null;
  return <SetupForm mode={mode} path={typeof path === 'string' ? path : undefined} />;
}

function SetupForm({ mode, path }: { mode: SetupMode; path: string | undefined }) {
  const router = useRouter();
  const workspace = useListStore((state) => state.workspace);
  const existing = mode === 'existing' ? workspace : null;

  // Read once, on the first render: re-seeding on every change would undo choices.
  const [seed] = useState(
    () =>
      (mode === 'existing' ? buildSetupSeed(listStore.getState(), pathFromKey(path)) : undefined) ??
      pasteSeed(pasteDraft.getState()),
  );
  const draft = useSourceDraft(seed);
  const [workWidth, setWorkWidth] = useState(0);

  // What the card preview can draw: objects with their fields, plain items as
  // their text. Anything else (a nested list) has no card to show.
  const previewEntries = useMemo(() => {
    // In the sort's order, so a wrong direction shows on the cards before starting.
    const ordered =
      draft.sort === null
        ? draft.entries
        : orderBySortField(draft.entries, draft.sort).map((index) => draft.entries[index]);
    return ordered.filter(
      (entry): entry is ItemValue =>
        isPlainObject(entry) || ['string', 'number', 'boolean'].includes(typeof entry),
    );
  }, [draft.entries, draft.sort]);
  // The ranking screen's stage is as wide as this one, so whether its pair
  // will stack, and draw compact cards, can be told from here.
  const compactCards =
    workWidth > 0 && pairStacks(workWidth, cardLayout(draft.roles).pictureFields.length > 0);

  const answerCounts = useMemo(
    () => (existing === null ? undefined : selectAnswerCounts(existing)),
    [existing],
  );
  const configLines = useMemo(
    () =>
      selectConfigLines(
        existing,
        draft.analysis.document,
        draft.analysis.candidates,
        draft.selectedPath === null
          ? null
          : {
              path: draft.selectedPath,
              roles: draft.roles,
              startingOrder: draft.startingOrder,
              ...(draft.sort === null ? {} : { sort: draft.sort }),
            },
      ),
    [
      existing,
      draft.analysis.document,
      draft.analysis.candidates,
      draft.selectedPath,
      draft.roles,
      draft.startingOrder,
      draft.sort,
    ],
  );

  const readiness = describeReadiness({
    candidates: draft.analysis.candidates,
    selectedPath: draft.selectedPath,
    entries: draft.entries,
    roles: draft.roles,
    hasIssues: draft.analysis.issues.length > 0,
  });

  // A list's starting order is fixed when it is created, so it can only be
  // chosen for a list this document has never opened.
  const orderLocked =
    existing !== null && draft.selectedPath !== null && listAt(existing, draft.selectedPath) !== undefined;
  // A sort belongs to the list it was chosen for, so it never becomes a default:
  // with one set, the defaults keep the order they already have.
  const defaultOrder =
    draft.sort === null || existing === null ? draft.startingOrder : existing.listDefaults.startingOrder;
  const settingsAreDefault =
    existing !== null &&
    sameRoles(existing.listDefaults.roles, draft.roles) &&
    existing.listDefaults.startingOrder === defaultOrder;

  function handleSubmit() {
    const source = draft.toSource();
    if (source === null) return;

    const current = listStore.getState().workspace;
    if (mode === 'new' || current === null) {
      listStore.getState().startRanking({
        source,
        roles: draft.roles,
        startingOrder: draft.startingOrder,
        sort: draft.sort ?? undefined,
      });
      pasteDraft.getState().clear();
    } else if (!samePath(source.arrayPath, current.source.arrayPath)) {
      // Saving what the defaults already give is no choice: the list keeps
      // following them. Any change detaches the whole list.
      const derived = selectListConfig(current, source.arrayPath);
      const unchanged =
        draft.sort === null &&
        sameRoles(derived.roles, draft.roles) &&
        derived.startingOrder === draft.startingOrder;
      listStore.getState().switchList({
        source,
        roles: draft.roles,
        startingOrder: draft.startingOrder,
        sort: draft.sort ?? undefined,
        configuredExplicitly: !unchanged,
      });
    } else if (!sameRoles(activeList(current).roles, draft.roles)) {
      // Only how the cards look: no answer is given, so none is recorded.
      listStore.getState().setListRoles(draft.roles);
    }
    leaveSetup();
  }

  /**
   * Back to the ranking. The stack keeps every screen it has shown, so the
   * ranking this was opened from is returned to, not stacked again; a new list
   * drops the paste page it came from too. A direct load has nothing to go back to.
   */
  function leaveSetup() {
    if (mode === 'new') {
      if (router.canDismiss()) router.dismissAll();
      router.replace('/rank');
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/rank');
    }
  }

  const ctaLabel = mode === 'existing' ? 'Save' : 'Start ranking';

  return (
    <>
      <Head>
        <title>Pairwise: list setup</title>
      </Head>
      <AppShell
        dock={
          <StartCta
            label={ctaLabel}
            reason={readiness.reason}
            ready={readiness.ready}
            onSubmit={handleSubmit}
          />
        }
        stage={
          // The text box is gone, so the whole stage is the cards: they are
          // beside the panel while there is room, and under it when not.
          <View style={styles.work} onLayout={(event) => setWorkWidth(event.nativeEvent.layout.width)}>
            <CardPreview
              entries={previewEntries}
              roles={draft.roles}
              fill={!compactCards}
              compact={compactCards}
            />
          </View>
        }
        preview={
          <FoundPanel
            analysis={draft.analysis}
            selectedPath={draft.selectedPath}
            roles={draft.roles}
            startingOrder={draft.startingOrder}
            startingOrderLocked={orderLocked}
            isDefault={settingsAreDefault}
            entries={draft.entries}
            sort={draft.sort}
            sortFields={draft.sortFields}
            ctaLabel={ctaLabel}
            answerCounts={answerCounts}
            configLines={configLines}
            onSelectPath={draft.selectPath}
            onRolesChange={draft.setRoles}
            onStartingOrderChange={draft.setStartingOrder}
            onSortChange={draft.setSort}
            onSetAsDefault={
              existing === null
                ? undefined
                : () =>
                    listStore.getState().setListDefaults({
                      roles: draft.roles,
                      startingOrder: defaultOrder,
                    })
            }
            onSubmit={handleSubmit}
          />
        }
      />
    </>
  );
}

const styles = StyleSheet.create({
  // Fills the stage, so the preview can take the height.
  work: { flex: 1 },
});
