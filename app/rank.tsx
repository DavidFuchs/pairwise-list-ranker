import { useRouter } from "expo-router";
import { useEffect } from "react";

import { ComparisonDeck } from "@/components/comparison/ComparisonDeck";
import { AppShell } from "@/components/layout/AppShell";
import { ListSwitcher } from "@/components/layout/ListSwitcher";
import type { ListSwitcherOption } from "@/components/layout/ListSwitcher";
import { PageNav } from "@/components/layout/PageNav";
import { PreviewPane } from "@/components/preview/PreviewPane";
import { Button } from "@/components/ui/Button";
import { downloadName, exportFilename } from "@/lib/export/filenames";
import { findArrayCandidates } from "@/lib/import/arrayCandidates";
import {
  describeRoles,
  selectAvailableTabs,
  selectContextLine,
  selectExportText,
  selectListConfig,
  selectProgress,
  selectRemovedCount,
  selectWorkspaceView,
} from "@/lib/state/selectors";
import { listStore, useListStore } from "@/lib/state/useListStore";
import type { DataSource, SourceFormat } from "@/types/source";

export default function RankScreen() {
  const router = useRouter();
  const workspace = useListStore((state) => state.workspace);
  const items = useListStore((state) => state.items);
  const comparisonEvents = useListStore((state) => state.comparisonEvents);
  const savedLists = useListStore((state) => state.savedLists);
  const previewTab = useListStore((state) => state.previewTab);
  const hydrated = useListStore((state) => state.hydrated);
  const persistenceAvailable = useListStore(
    (state) => state.persistenceAvailable,
  );
  const saveOutcome = useListStore((state) => state.saveOutcome);

  useEffect(() => {
    listStore.getState().hydrate();
  }, []);

  // Landing here with nothing to rank means a stale link or a cleared browser.
  useEffect(() => {
    if (hydrated && workspace === null) router.replace("/");
  }, [hydrated, workspace, router]);

  const view = selectWorkspaceView(
    items,
    comparisonEvents,
    workspace?.alreadyRanked ?? false,
  );
  const progress = selectProgress(
    items,
    comparisonEvents,
    workspace?.alreadyRanked ?? false,
  );
  const format: SourceFormat =
    previewTab === "ranked" ? (workspace?.source.format ?? "list") : previewTab;
  const exportText =
    previewTab === "ranked"
      ? ""
      : selectExportText(workspace, items, comparisonEvents, format);

  // The static build renders without localStorage, so the persistence answer
  // only exists after hydration. Showing it sooner mismatches the served HTML.
  const statusText = !hydrated
    ? "Working locally"
    : saveOutcome === "too-large"
      ? "Too large to save in this browser"
      : persistenceAvailable
        ? "Saved in this browser"
        : "Memory only";

  if (workspace === null) return null;

  const { candidates } = findArrayCandidates(workspace.source.document);
  const listOptions: ListSwitcherOption[] = candidates.map((candidate) => {
    const key = candidate.path.join(".");
    const config = selectListConfig(workspace, savedLists, candidate.path);
    const configLine = describeRoles(config.roles, config.alreadyRanked);

    const saved = savedLists.find((list) => list.arrayPath.join(".") === key);
    const progress =
      key === workspace.source.arrayPath.join(".")
        ? selectProgress(items, comparisonEvents, workspace.alreadyRanked)
        : saved === undefined
          ? undefined
          : selectProgress(
              saved.items,
              saved.comparisonEvents,
              saved.alreadyRanked,
            );

    return {
      ...candidate,
      configLine,
      coverage:
        progress !== undefined && progress.coverage > 0
          ? { coverage: progress.coverage, earned: progress.earnedCoverage }
          : undefined,
    };
  });

  // Every list switches instantly, including one never chosen before: rather
  // than stopping the user at the data screen to answer questions they have
  // already answered for this document, it inherits the active list's setup -
  // see selectListConfig, which keeps the inherited field only where the new
  // list can carry it. The switcher shows that answer on every row, and
  // Configure is there for the times the guess is wrong.
  function switchToList(path: string[]) {
    if (workspace === null) return;

    const source: DataSource = { ...workspace.source, arrayPath: path };
    const { roles, alreadyRanked } = selectListConfig(
      workspace,
      savedLists,
      path,
    );
    // Derived, not chosen: leaving it unmarked is what lets a later change to
    // the document defaults still reach this list.
    listStore
      .getState()
      .switchList({
        source,
        roles,
        alreadyRanked,
        configuredExplicitly: false,
      });
  }

  /** Changes a list's fields or its order, on the screen that owns those. */
  function configureList(path: string[]) {
    listStore.getState().requestListSwitch(path);
    router.replace("/");
  }

  return (
    <AppShell
      listName={selectContextLine(workspace)}
      statusText={statusText}
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
        router.replace("/");
      }}
      stage={
        <>
          <PageNav>
            <Button
              label="‹ Edit data"
              accessibilityLabel="Edit data"
              variant="secondary"
              size="sm"
              onPress={() => router.replace("/")}
            />
          </PageNav>
          <ComparisonDeck
            pair={view.pair}
            progress={progress}
            sortField={workspace.roles.labelField}
            onOutcome={(outcome) => {
              if (view.pair === null) return;
              listStore
                .getState()
                .recordComparison(
                  view.pair.left.id,
                  view.pair.right.id,
                  outcome,
                );
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
          labelField={workspace.roles.labelField}
          exportText={exportText}
          filename={exportFilename(downloadName(workspace.source), format)}
          format={format}
          removedCount={selectRemovedCount(items)}
          onReorder={(itemId, nextOrder) =>
            listStore.getState().reorderItem(itemId, nextOrder)
          }
        />
      }
    />
  );
}
