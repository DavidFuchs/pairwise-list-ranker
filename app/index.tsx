import { useRouter } from 'expo-router';
import { useEffect } from 'react';

import { FoundPanel } from '@/components/data/FoundPanel';
import { SourceInput } from '@/components/data/SourceInput';
import { AppShell } from '@/components/layout/AppShell';
import { useSourceDraft } from '@/lib/hooks/useSourceDraft';
import { listStore, useListStore } from '@/lib/state/useListStore';

export default function DataScreen() {
  const router = useRouter();
  const workspace = useListStore((state) => state.workspace);
  const hydrated = useListStore((state) => state.hydrated);
  const resumed = useListStore((state) => state.resumed);

  const draft = useSourceDraft();

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

  function handleSubmit() {
    const source = draft.toSource();
    if (source === null) return;
    listStore.getState().startRanking({ source, roles: draft.roles });
    router.push('/rank');
  }

  return (
    <AppShell
      listName="New list"
      statusText="Nothing saved yet"
      stage={
        <SourceInput
          value={draft.rawText}
          onChange={draft.setRawText}
          override={draft.override}
          onOverrideChange={draft.setOverride}
          format={draft.analysis.format}
          issues={draft.rawText.trim() === '' ? [] : draft.analysis.issues}
        />
      }
      preview={
        <FoundPanel
          analysis={draft.analysis}
          selectedPath={draft.selectedPath}
          roles={draft.roles}
          entries={draft.entries}
          ctaLabel="Start ranking"
          onSelectPath={draft.selectPath}
          onRolesChange={draft.setRoles}
          onSubmit={handleSubmit}
        />
      }
    />
  );
}
