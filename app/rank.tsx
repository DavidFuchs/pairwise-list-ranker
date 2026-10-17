import { useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';

import { ComparisonDeck } from '@/components/comparison/ComparisonDeck';
import { AppShell } from '@/components/layout/AppShell';
import { ListSwitcher } from '@/components/layout/ListSwitcher';
import { PageNav } from '@/components/layout/PageNav';
import { PreviewPane } from '@/components/preview/PreviewPane';
import type { OpenOutcome } from '@/components/preview/SessionControls';
import { Button } from '@/components/ui/Button';
import { cardLayout, EMPTY_LAYOUT } from '@/lib/renderers';
import { downloadText, pickTextFile } from '@/lib/browser/exportActions';
import { downloadName, exportFilename, slugify } from '@/lib/export/filenames';
import {
  buildSessionFile,
  confirmOpenSession,
  describeSession,
  hasDecisions,
  readSavedFile,
} from '@/lib/session/sessionFile';
import {
  selectAvailableTabs,
  selectContextLine,
  selectExportText,
  selectListConfig,
  selectListOptions,
  selectProgress,
  selectRemovedCount,
  selectStability,
  selectWorkspaceView,
} from '@/lib/state/selectors';
import { activeList } from '@/lib/state/lists';
import { listStore, useListStore } from '@/lib/state/useListStore';
import type { ListItem } from '@/types/list';
import type { ComparisonEvent } from '@/types/ranking';
import type { DataSource, SourceFormat } from '@/types/source';

/** Shared empties, so the view cache recognises "nothing loaded" between renders. */
const NO_ITEMS: ListItem[] = [];
const NO_EVENTS: ComparisonEvent[] = [];

/**
 * Opens a session file. A session replaces everything, so with decisions on
 * the line it asks first.
 */
function openSavedFile(text: string): OpenOutcome {
  const saved = readSavedFile(text);
  if (saved.type === 'unreadable') return { message: saved.reason };
  if (saved.type === 'other') return { message: 'That is not a session file from this app.' };

  const summary = describeSession(saved.session);
  const apply = () => {
    listStore.getState().loadSession(saved.session);
    return `Opened the session: ${summary}.`;
  };
  return hasDecisions(listStore.getState().workspace)
    ? { confirm: confirmOpenSession(saved.session), apply }
    : { message: apply() };
}

export default function RankScreen() {
  const router = useRouter();
  const workspace = useListStore((state) => state.workspace);
  const previewTab = useListStore((state) => state.previewTab);
  const hydrated = useListStore((state) => state.hydrated);
  const persistenceAvailable = useListStore((state) => state.persistenceAvailable);
  const saveOutcome = useListStore((state) => state.saveOutcome);
  const canUndo = useListStore((state) => state.undoStack.length > 0);
  const roles = useListStore((state) =>
    state.workspace === null ? undefined : activeList(state.workspace).roles,
  );

  useEffect(() => {
    listStore.getState().hydrate();
    // Opening the site on this page is already the resume the data screen
    // would otherwise do. Left unmarked, the first trip to Edit data would be
    // taken for that resume and bounced straight back here.
    listStore.getState().markResumed();
  }, []);

  // Landing here with nothing to rank means a stale link or a cleared browser.
  useEffect(() => {
    if (hydrated && workspace === null) router.replace('/');
  }, [hydrated, workspace, router]);

  const list = workspace === null ? null : activeList(workspace);
  const items = list?.items ?? NO_ITEMS;
  const comparisonEvents = list?.comparisonEvents ?? NO_EVENTS;
  const alreadyRanked = list?.alreadyRanked ?? false;
  const view = selectWorkspaceView(items, comparisonEvents, alreadyRanked);
  const progress = selectProgress(items, comparisonEvents, alreadyRanked);
  const stability = selectStability(view.ranking, comparisonEvents);
  const format: SourceFormat = previewTab === 'ranked' ? (workspace?.source.format ?? 'list') : previewTab;
  // Serializing a large document is the slowest thing this screen does, and
  // it only changes when the data or the tab does.
  const exportText = useMemo(
    () => (previewTab === 'ranked' ? '' : selectExportText(workspace, format)),
    [previewTab, workspace, format],
  );

  // Only a problem is worth saying, and only once hydrated: the static build
  // renders without localStorage, so the answer does not exist sooner.
  const saveWarning = !hydrated
    ? undefined
    : saveOutcome === 'too-large'
      ? 'Too large to save in this browser'
      : persistenceAvailable
        ? undefined
        : 'Not saved: this browser is not keeping data';

  // Kept while the roles are, so the ranked rows can reuse what they drew.
  const layout = useMemo(() => (roles === undefined ? EMPTY_LAYOUT : cardLayout(roles)), [roles]);

  if (workspace === null || list === null) return null;

  const listOptions = selectListOptions(workspace);

  // Every list switches instantly, including one never chosen before: rather
  // than stopping the user at the data screen to answer questions they have
  // already answered for this document, it inherits the active list's setup -
  // see selectListConfig, which keeps the inherited field only where the new
  // list can carry it. The switcher shows that answer on every row, and
  // Configure is there for the times the guess is wrong.
  function switchToList(path: string[]) {
    if (workspace === null) return;

    const source: DataSource = { ...workspace.source, arrayPath: path };
    const { roles, alreadyRanked } = selectListConfig(workspace, path);
    // Derived, not chosen: leaving it unmarked is what lets a later change to
    // the document defaults still reach this list.
    listStore.getState().switchList({
      source,
      roles,
      alreadyRanked,
      configuredExplicitly: false,
    });
  }

  /** Changes a list's fields or its order, on the screen that owns those. */
  function configureList(path: string[]) {
    listStore.getState().requestListSwitch(path);
    router.replace('/');
  }

  return (
    <AppShell
      listName={selectContextLine(workspace)}
      saveWarning={saveWarning}
      listSwitcher={
        <ListSwitcher
          currentPath={workspace.source.arrayPath}
          caption={selectContextLine(workspace)}
          options={listOptions}
          onSelect={switchToList}
          onConfigure={configureList}
        />
      }
      onReset={() => {
        listStore.getState().reset();
        router.replace('/');
      }}
      stage={
        <>
          <PageNav>
            <Button
              label="‹ Edit data"
              accessibilityLabel="Edit data"
              variant="secondary"
              size="sm"
              onPress={() => router.replace('/')}
            />
          </PageNav>
          <ComparisonDeck
            pair={view.pair}
            progress={progress}
            layout={layout}
            onUndo={canUndo ? () => listStore.getState().undo() : undefined}
            stability={stability}
            onOutcome={(outcome) => {
              if (view.pair === null) return;
              listStore.getState().recordComparison(view.pair.left.id, view.pair.right.id, outcome);
            }}
            onDelete={(itemId) => listStore.getState().removeItem(itemId)}
          />
        </>
      }
      preview={
        <PreviewPane
          tab={previewTab}
          tabs={selectAvailableTabs(workspace)}
          onTabChange={(tab) => listStore.getState().setPreviewTab(tab)}
          ranking={view.ranking}
          layout={layout}
          exportText={exportText}
          filename={exportFilename(downloadName(workspace.source), format)}
          format={format}
          removedCount={selectRemovedCount(items)}
          onReorder={(itemId, nextOrder) => listStore.getState().reorderItem(itemId, nextOrder)}
          sessionFile={{
            onSave: () => {
              const session = listStore.getState().snapshot();
              if (session === null) return 'Nothing to save yet';
              const file = buildSessionFile(session, new Date().toISOString());
              const name = `${slugify(downloadName(workspace.source))}-session.json`;
              return downloadText(name, JSON.stringify(file, null, 2), 'application/json')
                ? `Saved ${name}`
                : 'Download unavailable';
            },
            onOpen: async () => {
              const text = await pickTextFile('application/json,.json');
              if (text === null) return null;
              return openSavedFile(text);
            },
          }}
        />
      }
    />
  );
}
