import { useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { useEffect, useMemo, useState } from 'react';

import { ComparisonDeck } from '@/components/comparison/ComparisonDeck';
import type { DeckStatus } from '@/components/comparison/ComparisonDeck';
import { FileNotice } from '@/components/data/FileNotice';
import type { FileNoticeState } from '@/components/data/FileNotice';
import { AppShell } from '@/components/layout/AppShell';
import { ListSwitcher } from '@/components/layout/ListSwitcher';
import { PreviewPane } from '@/components/preview/PreviewPane';
import type { OpenOutcome } from '@/components/preview/SessionControls';
import { useEngineView } from '@/lib/engine/engineHost';
import { useProgress } from '@/lib/hooks/useProgress';
import type { EngineView } from '@/lib/engine/engineHost';
import { cardLayout, EMPTY_LAYOUT } from '@/lib/renderers';
import { downloadText, pickTextFile } from '@/lib/browser/exportActions';
import { readTextFile } from '@/lib/browser/fileText';
import { sessionFilename } from '@/lib/export/filenames';
import {
  buildSessionFile,
  confirmOpenSession,
  describeLostWork,
  describeSession,
  hasChanges,
  readSavedFile,
} from '@/lib/session/sessionFile';
import {
  selectAvailableTabs,
  selectContextLine,
  selectTitleFits,
  selectExportText,
  selectListConfig,
  selectListOptions,
} from '@/lib/state/selectors';
import { useScreenFocused } from '@/lib/hooks/useScreenFocused';
import { formatPath } from '@/lib/import/arrayCandidates';
import { pathKey } from '@/lib/import/paths';
import { activeList, listAt } from '@/lib/state/lists';
import { activeItems, removedCount } from '@/lib/state/membership';
import { pasteDraft } from '@/lib/state/pasteDraft';
import { listStore, undoOffer, useListStore } from '@/lib/state/useListStore';
import type { ListItem } from '@/types/list';
import type { DataSource, SourceFormat } from '@/types/source';

/** Downloads the whole session as a file, and says how that went. */
function saveSession(): string {
  const session = listStore.getState().snapshot();
  if (session === null) return 'Nothing to save yet';
  const file = buildSessionFile(session, new Date().toISOString());
  const name = sessionFilename();
  return downloadText(name, JSON.stringify(file, null, 2), 'application/json')
    ? `Saved ${name}`
    : 'Download unavailable';
}

/** What the deck and the ranked list show of the open list. */
interface ShownView {
  status: DeckStatus;
  ranked: ListItem[];
  unrecognized: ListItem[];
  pair: readonly [ListItem, ListItem] | null;
  answers: number;
  disorder: number | null;
}

const RESTORING: ShownView = {
  status: 'restoring',
  ranked: [],
  unrecognized: [],
  pair: null,
  answers: 0,
  disorder: null,
};

function shownView(view: EngineView | null, listId: string | undefined): ShownView {
  // A view of another list, or none yet, is the moment before the open list's
  // own sync: as good as restoring, since nothing in it belongs to this list.
  if (view === null || view.listId !== listId || view.status === 'restoring') return RESTORING;
  return {
    status: view.fallback === 'arrival' ? 'unrestored' : 'ready',
    ranked: view.ranked,
    unrecognized: view.unrecognized,
    pair: view.nextPair,
    answers: view.answers,
    disorder: view.disorder,
  };
}

/**
 * Opens a session file. A session replaces everything, so with decisions on
 * the line it asks first.
 */
function openSavedFile(saved: ReturnType<typeof readSavedFile>): OpenOutcome {
  if (saved.type === 'unreadable') return { message: saved.reason };
  if (saved.type === 'other') return { message: 'That is not a session file from this app.' };

  const summary = describeSession(saved.session);
  const apply = () => {
    listStore.getState().loadSession(saved.session);
    return `Opened the session: ${summary}.`;
  };
  return hasChanges(listStore.getState().workspace)
    ? { confirm: confirmOpenSession(saved.session), apply }
    : { message: apply() };
}

/**
 * A file dropped on the ranking screen. A saved session opens as Open session
 * would; anything else is left alone, since a new list belongs on the paste
 * page, which Start over leads to.
 */
async function openDroppedFile(file: File): Promise<OpenOutcome> {
  const notSession = {
    message: `"${file.name}" is not a saved session. To rank a new list, use Start over and paste it.`,
  };
  const read = await readTextFile(file);
  if ('refused' in read) return notSession;
  const saved = readSavedFile(read.text);
  return saved.type === 'other' ? notSession : openSavedFile(saved);
}

export default function RankScreen() {
  const router = useRouter();
  const workspace = useListStore((state) => state.workspace);
  const previewTab = useListStore((state) => state.previewTab);
  const hydrated = useListStore((state) => state.hydrated);
  const persistenceAvailable = useListStore((state) => state.persistenceAvailable);
  const saveOutcome = useListStore((state) => state.saveOutcome);
  // 'here', the name of the list the step back belongs to, or null.
  const undoPlace = useListStore((state) => {
    const offer = undoOffer(state);
    return offer === null || offer === 'here' ? offer : formatPath(offer);
  });
  const roles = useListStore((state) =>
    state.workspace === null ? undefined : activeList(state.workspace).roles,
  );
  const engineView = useEngineView();
  const [fileNotice, setFileNotice] = useState<FileNoticeState | null>(null);

  useEffect(() => {
    listStore.getState().hydrate();
  }, []);

  // Arriving here with nothing to rank means a stale link or a cleared browser.
  // Only from the front: a ranking kept mounted behind another screen must not
  // replace it.
  const focused = useScreenFocused();
  useEffect(() => {
    if (focused && hydrated && workspace === null) router.replace('/');
  }, [focused, hydrated, workspace, router]);

  const list = useListStore((state) => (state.workspace === null ? null : activeList(state.workspace)));
  const listId = list?.id;
  // Memoized, so what is worked out from it below is kept while it is.
  const view = useMemo(() => shownView(engineView, listId), [engineView, listId]);
  const ready = view.status === 'ready';
  const progress = useProgress(list, view);
  const format: SourceFormat = previewTab === 'ranked' ? (workspace?.source.format ?? 'list') : previewTab;
  // Serializing a large document is the slowest thing this screen does, and
  // it only changes when the data or the tab does. Not while restoring: the
  // order would take a replay on the main thread, the work the restore keeps off it.
  const exportText = useMemo(
    () => (previewTab === 'ranked' || !ready ? '' : selectExportText(workspace, format)),
    [previewTab, workspace, format, ready],
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

  // A list switches instantly, including one never chosen before: rather than
  // stopping the user at list setup to answer questions they have already
  // answered for this document, it takes the document's defaults - see
  // selectListConfig, which keeps a default field only where the new list can
  // carry it. The exception is a never-opened list missing any field the
  // defaults name: that is a different kind of list, so it opens in setup. The
  // switcher shows the derived answer on every row, and Configure is there for
  // the times the guess is wrong.
  function switchToList(path: string[]) {
    if (workspace === null) return;

    // A list never opened before that lacks the default title field is a
    // different kind of list: what the defaults would make of it is a guess.
    if (listAt(workspace, path) === undefined && !selectTitleFits(workspace, path)) {
      configureList(path);
      return;
    }

    const source: DataSource = { ...workspace.source, arrayPath: path };
    const { roles, startingOrder } = selectListConfig(workspace, path);
    // Derived, not chosen: leaving it unmarked is what lets a later change to
    // the document defaults still reach this list.
    listStore.getState().switchList({
      source,
      roles,
      startingOrder,
      configuredExplicitly: false,
    });
  }

  /** Changes a list's fields or its order, on the screen that owns those. */
  function configureList(path: string[]) {
    router.push({ pathname: '/setup', params: { path: pathKey(path) } });
  }

  // While restoring, nothing is recorded, an undo included.
  const onUndo = undoPlace === 'here' && ready ? () => listStore.getState().undo() : undefined;
  const undoElsewhere = undoPlace !== null && undoPlace !== 'here' ? undoPlace : undefined;
  const markUnrecognized = (ids: string[]) => {
    if (ready) listStore.getState().markUnrecognized(ids);
  };
  async function handleFileDrop(file: File) {
    const outcome = await openDroppedFile(file);
    setFileNotice(
      'confirm' in outcome
        ? { confirm: outcome.confirm, onConfirm: () => setFileNotice({ message: outcome.apply() }) }
        : { message: outcome.message },
    );
  }

  return (
    <>
      <Head>
        <title>{`Pairwise: ranking ${formatPath(workspace.source.arrayPath)}`}</title>
      </Head>
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
          // Start over means an empty paste page, not the text of the list just cleared.
          pasteDraft.getState().clear();
          router.replace('/');
        }}
        resetCost={describeLostWork(workspace)}
        onSaveBeforeReset={saveSession}
        onFileDrop={(file) => void handleFileDrop(file)}
        dropTitle="Drop a saved session to open it"
        stage={
          <>
            {fileNotice !== null && <FileNotice notice={fileNotice} onDismiss={() => setFileNotice(null)} />}
            <ComparisonDeck
              pair={view.pair}
              answers={view.answers}
              status={view.status}
              activeItems={activeItems(list).length}
              layout={layout}
              progress={progress}
              onUndo={onUndo}
              undoElsewhere={undoElsewhere}
              onOutcome={(outcome) => {
                if (!ready || view.pair === null) return;
                const [left, right] = view.pair;
                listStore.getState().recordComparison(left.id, right.id, outcome);
              }}
              onDelete={(itemId) => {
                if (ready) listStore.getState().removeItem(itemId);
              }}
              onMarkUnrecognized={markUnrecognized}
            />
          </>
        }
        preview={
          <PreviewPane
            tab={previewTab}
            tabs={selectAvailableTabs(workspace)}
            onTabChange={(tab) => listStore.getState().setPreviewTab(tab)}
            ranked={view.ranked}
            unrecognized={view.unrecognized}
            status={view.status}
            layout={layout}
            decided={list.events.length > 0}
            trustedOrder={list.initialStartingOrder === 'ranked'}
            exportText={exportText}
            getExportText={(chosen) => selectExportText(workspace, chosen)}
            format={format}
            removedCount={removedCount(list)}
            onReorder={(itemId, nextOrder) => {
              if (ready) listStore.getState().reorderItem(itemId, nextOrder);
            }}
            onRemove={(itemId) => {
              if (ready) listStore.getState().removeItem(itemId);
            }}
            onOpenSetup={() => router.push('/setup')}
            sessionFile={{
              onSave: saveSession,
              onOpen: async () => {
                const text = await pickTextFile('application/json,.json');
                if (text === null) return null;
                return openSavedFile(readSavedFile(text));
              },
            }}
          />
        }
      />
    </>
  );
}
