import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';

import { ApplySummary } from '@/components/data/ApplySummary';
import { FoundPanel } from '@/components/data/FoundPanel';
import { SourceInput } from '@/components/data/SourceInput';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { useSourceDraft } from '@/lib/hooks/useSourceDraft';
import { diffImport } from '@/lib/import/diff';
import type { ImportDiff } from '@/lib/import/diff';
import { listStore, useListStore } from '@/lib/state/useListStore';

export default function DataScreen() {
  const router = useRouter();
  const workspace = useListStore((state) => state.workspace);
  const hydrated = useListStore((state) => state.hydrated);
  const resumed = useListStore((state) => state.resumed);

  // Read once, on the first render after hydration: re-seeding on every
  // keystroke would fight the user's typing.
  const seed = useMemo(
    () =>
      listStore.getState().workspace === null
        ? undefined
        : {
            rawText: listStore.getState().workspace!.source.rawText,
            arrayPath: listStore.getState().workspace!.source.arrayPath,
            roles: listStore.getState().workspace!.roles,
          },
    [],
  );

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

  function handleSubmit() {
    const source = draft.toSource();
    if (source === null) return;

    if (!editing) {
      listStore.getState().startRanking({ source, roles: draft.roles });
      router.replace('/rank');
      return;
    }

    const { items, comparisonEvents } = listStore.getState();
    setPending(diffImport(items, draft.entries, comparisonEvents));
  }

  function handleConfirm() {
    const source = draft.toSource();
    if (source === null) return;
    listStore.getState().applyEdits({ source, roles: draft.roles });
    setPending(null);
    router.replace('/rank');
  }

  return (
    <AppShell
      listName={workspace?.name ?? 'New list'}
      statusText={editing ? 'Editing your data' : 'Nothing saved yet'}
      headerAction={
        editing ? (
          <Button
            label="Back to ranking"
            accessibilityLabel="Back to ranking"
            variant="ghost"
            size="sm"
            onPress={() => router.replace('/rank')}
          />
        ) : undefined
      }
      stage={
        <SourceInput
          value={draft.rawText}
          onChange={(text) => {
            setPending(null);
            draft.setRawText(text);
          }}
          override={draft.override}
          onOverrideChange={draft.setOverride}
          format={draft.analysis.format}
          issues={draft.rawText.trim() === '' ? [] : draft.analysis.issues}
        />
      }
      preview={
        pending === null ? (
          <FoundPanel
            analysis={draft.analysis}
            selectedPath={draft.selectedPath}
            roles={draft.roles}
            entries={draft.entries}
            ctaLabel={editing ? 'Apply edits' : 'Start ranking'}
            onSelectPath={draft.selectPath}
            onRolesChange={draft.setRoles}
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
