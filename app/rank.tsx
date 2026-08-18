import { useRouter } from 'expo-router';
import { useEffect } from 'react';

import { ComparisonDeck } from '@/components/comparison/ComparisonDeck';
import { AppShell } from '@/components/layout/AppShell';
import { PreviewPane } from '@/components/preview/PreviewPane';
import { Button } from '@/components/ui/Button';
import { downloadName, exportFilename } from '@/lib/export/filenames';
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

  const view = selectWorkspaceView(items, comparisonEvents, workspace?.alreadyRanked ?? false);
  const progress = selectProgress(items, comparisonEvents, workspace?.alreadyRanked ?? false);
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

  return (
    <AppShell
      listName={selectContextLine(workspace)}
      statusText={statusText}
      headerAction={
        <Button
          label="Edit data"
          accessibilityLabel="Edit data"
          variant="ghost"
          size="sm"
          onPress={() => router.replace('/')}
        />
      }
      onReset={() => {
        listStore.getState().reset();
        router.replace('/');
      }}
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
          filename={exportFilename(downloadName(workspace.source), format)}
          format={format}
          comparisonCount={progress.comparisons}
          removedCount={selectRemovedCount(items)}
          onReorder={(itemIds) => listStore.getState().reorderAndRestart(itemIds)}
        />
      }
    />
  );
}
