import { useEffect, useState } from 'react';

import { ComparisonDeck } from '@/components/comparison/ComparisonDeck';
import { AppShell } from '@/components/layout/AppShell';
import { EmptyState } from '@/components/lists/EmptyState';
import { ListControls } from '@/components/lists/ListControls';
import { PreviewPane } from '@/components/preview/PreviewPane';
import { exportFilename, serializeDocument } from '@/lib/formats';
import {
  selectDocument,
  selectNeedsSortField,
  selectProgress,
  selectWorkspaceView,
} from '@/lib/state/selectors';
import { listStore, useListStore } from '@/lib/state/useListStore';
import type { ParseIssue } from '@/lib/validation/listSchemas';
import type { ExportFormat, TextFormat } from '@/types/list';

export default function WorkspaceScreen() {
  const list = useListStore((state) => state.list);
  const items = useListStore((state) => state.items);
  const comparisonEvents = useListStore((state) => state.comparisonEvents);
  const previewMode = useListStore((state) => state.previewMode);
  const editorDrafts = useListStore((state) => state.editorDrafts);
  const persistenceAvailable = useListStore((state) => state.persistenceAvailable);
  const hydrated = useListStore((state) => state.hydrated);

  /** Parse problems belong to the editor buffer, not to the live list. */
  const [issues, setIssues] = useState<{ format: TextFormat; issues: ParseIssue[] } | null>(null);

  useEffect(() => {
    listStore.getState().hydrate();
  }, []);

  const view = selectWorkspaceView(items, comparisonEvents);
  const progress = selectProgress(items, comparisonEvents);
  const textFormat = previewMode === 'gui' ? null : (previewMode as TextFormat);

  const document = list === null ? null : selectDocument(list, items, comparisonEvents);
  const exportText =
    document === null || textFormat === null ? '' : serializeDocument(document, textFormat);
  const filename =
    document === null || textFormat === null
      ? 'list.txt'
      : exportFilename(document, textFormat);

  // The static build renders without localStorage, so the persistence answer
  // only exists after hydration. Showing it sooner mismatches the served HTML.
  const statusText = !hydrated
    ? 'Working locally'
    : persistenceAvailable
      ? 'Saved in this browser'
      : 'Memory only';

  function handleModeChange(mode: ExportFormat) {
    listStore.getState().setPreviewMode(mode);
  }

  function handleDraftChange(text: string) {
    if (textFormat === null) return;
    listStore.getState().setEditorDraft(textFormat, text);
    setIssues(null);
  }

  function handleApply() {
    if (textFormat === null) return;
    const result = listStore.getState().applyEditorDraft(textFormat);
    setIssues(result.ok ? null : { format: textFormat, issues: result.issues });
  }

  const visibleIssues =
    issues !== null && textFormat !== null && issues.format === textFormat ? issues.issues : [];

  return (
    <AppShell
      listName={list?.title ?? 'No list yet'}
      statusText={statusText}
      onReset={() => {
        listStore.getState().reset();
        setIssues(null);
      }}
      rail={
        list === null ? null : (
          <ListControls
            list={list}
            items={items}
            onAddItem={(value) => listStore.getState().addItem(value)}
            onRemoveItem={(itemId) => listStore.getState().removeItem(itemId)}
          />
        )
      }
      stage={
        list === null ? (
          <EmptyState />
        ) : (
          <ComparisonDeck
            pair={view.pair}
            progress={progress}
            sortField={list.sortField}
            needsSortField={selectNeedsSortField(list)}
            onOutcome={(outcome) => {
              if (view.pair === null) return;
              listStore
                .getState()
                .recordComparison(view.pair.left.id, view.pair.right.id, outcome);
            }}
            onDelete={(itemId) => listStore.getState().removeItem(itemId)}
          />
        )
      }
      preview={
        <PreviewPane
          mode={previewMode}
          onModeChange={handleModeChange}
          ranking={view.ranking}
          sortField={list?.sortField}
          exportText={exportText}
          filename={filename}
          draft={textFormat === null ? undefined : editorDrafts[textFormat]}
          onDraftChange={handleDraftChange}
          onApply={handleApply}
          issues={visibleIssues}
        />
      }
    />
  );
}
