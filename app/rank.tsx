import { useRouter } from 'expo-router';
import { useEffect } from 'react';

import { ComparisonDeck } from '@/components/comparison/ComparisonDeck';
import { AppShell } from '@/components/layout/AppShell';
import { PreviewPane } from '@/components/preview/PreviewPane';
import { RankRail } from '@/components/rank/RankRail';
import { exportFilename } from '@/lib/export/filenames';
import {
  selectAvailableTabs,
  selectContextLine,
  selectExportText,
  selectProgress,
  selectRemovedCount,
  selectWorkspaceView,
} from '@/lib/state/selectors';
import { listStore, useListStore } from '@/lib/state/useListStore';
import type { SourceFormat } from '@/types/source';

export default function RankScreen() {
  const router = useRouter();
  const workspace = useListStore((state) => state.workspace);
  const items = useListStore((state) => state.items);
  const comparisonEvents = useListStore((state) => state.comparisonEvents);
  const previewTab = useListStore((state) => state.previewTab);
  const hydrated = useListStore((state) => state.hydrated);
  const persistenceAvailable = useListStore((state) => state.persistenceAvailable);
  const saveOutcome = useListStore((state) => state.saveOutcome);

  useEffect(() => {
    listStore.getState().hydrate();
  }, []);

  // Landing here with nothing to rank means a stale link or a cleared browser.
  useEffect(() => {
    if (hydrated && workspace === null) router.replace('/');
  }, [hydrated, workspace, router]);

  const view = selectWorkspaceView(items, comparisonEvents);
  const progress = selectProgress(items, comparisonEvents);
  const format: SourceFormat =
    previewTab === 'ranked' ? (workspace?.source.format ?? 'list') : previewTab;
  const exportText =
    previewTab === 'ranked' ? '' : selectExportText(workspace, items, comparisonEvents, format);

  // The static build renders without localStorage, so the persistence answer
  // only exists after hydration. Showing it sooner mismatches the served HTML.
  const statusText = !hydrated
    ? 'Working locally'
    : saveOutcome === 'too-large'
      ? 'Too large to save in this browser'
      : persistenceAvailable
        ? 'Saved in this browser'
        : 'Memory only';

  if (workspace === null) return null;

  function startOver() {
    listStore.getState().reset();
    router.replace('/');
  }

  return (
    <AppShell
      listName={workspace.name}
      statusText={statusText}
      onReset={startOver}
      rail={
        <RankRail
          name={workspace.name}
          context={selectContextLine(workspace)}
          progress={progress}
          removedCount={selectRemovedCount(items)}
          onRename={(name) => listStore.getState().setName(name)}
          onEditData={() => router.replace('/')}
          onStartOver={startOver}
        />
      }
      stage={
        <ComparisonDeck
          pair={view.pair}
          progress={progress}
          sortField={workspace.roles.labelField}
          onOutcome={(outcome) => {
            if (view.pair === null) return;
            listStore.getState().recordComparison(view.pair.left.id, view.pair.right.id, outcome);
          }}
          onDelete={(itemId) => listStore.getState().removeItem(itemId)}
        />
      }
      preview={
        <PreviewPane
          tab={previewTab}
          tabs={selectAvailableTabs(workspace)}
          onTabChange={(tab) => listStore.getState().setPreviewTab(tab)}
          ranking={view.ranking}
          labelField={workspace.roles.labelField}
          exportText={exportText}
          filename={exportFilename(workspace.name, format)}
          format={format}
          comparisonCount={progress.comparisons}
          onReorder={(itemIds) => listStore.getState().reorderAndRestart(itemIds)}
        />
      }
    />
  );
}
