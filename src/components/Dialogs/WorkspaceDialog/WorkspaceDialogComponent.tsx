import * as React from "react";
import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {AnchorButton, Classes, type DialogProps, Icon, InputGroup, Intent, NonIdealState, Spinner} from "@blueprintjs/core";
import classNames from "classnames";
import {comparer, reaction} from "mobx";
import {observer} from "mobx-react";
import type {WorkspaceIssue, WorkspaceListItem} from "models";
import moment from "moment/moment";

import {DraggableDialogComponent} from "components/Dialogs";
import {DialogId, HelpType, WorkspaceDialogMode} from "enums";
import {AppStore} from "stores";
import {WorkspacePreflightStore} from "stores/Workspace/WorkspacePreflightStore";
import {WorkspaceSnapshotter} from "stores/Workspace/WorkspaceSnapshotter";

import {AppToaster, ErrorToast, ScrollShadow, SuccessToast} from "../../Shared";

import {WorkspaceInfoComponent, WorkspaceOpenInWindow, WorkspaceSaveChanges} from "./WorkspaceInfoComponent";
import {WorkspaceSaveCheckComponent} from "./WorkspaceSaveCheckComponent";

import "./WorkspaceDialogComponent.scss";

/** The most workspace names that the confirmation of a delete lists. Then the confirmation fits on the screen. */
const MAX_LISTED_DELETES = 10;

/** The column that the list of workspaces is sorted by. */
type SortKey = "name" | "date";

/** Returns when a workspace was modified: the time for today, and the date for an earlier day. */
function formatDate(unixDate: number): string {
    if (!(unixDate > 0)) {
        return "";
    }
    const time = moment.unix(unixDate);
    return moment(0, "HH").diff(time) <= 0 ? time.format("HH:mm") : time.format("D MMM YYYY");
}

export const WorkspaceDialogComponent = observer(() => {
    const [workspaceList, setWorkspaceList] = useState<WorkspaceListItem[]>();
    const [isFetching, setIsFetching] = useState(false);
    const [fetchErrorMessage, setFetchErrorMessage] = useState("");
    const [workspaceName, setWorkspaceName] = useState("");
    // The text that filters the list in the Open mode. Typing a name sets it, and selecting a workspace clears it.
    const [search, setSearch] = useState("");
    const [sort, setSort] = useState<{key: SortKey; isAscending: boolean}>({key: "date", isAscending: false});
    const [preflight, setPreflight] = useState<WorkspacePreflightStore>();
    const [isReadingWorkspace, setIsReadingWorkspace] = useState(false);
    const [readErrorMessage, setReadErrorMessage] = useState("");
    // The workspace that the summary shows. A later selection replaces a read that is still running.
    const selection = useRef<string | undefined>(undefined);
    // The workspaces that are selected with Cmd/Ctrl or Shift. The selection holds more than one
    // workspace only here. A plain click, or typing a name, selects one workspace again.
    const [selectedNames, setSelectedNames] = useState<string[]>([]);
    // The row that a Shift-click selects from: the row that was clicked last without Shift.
    const pivotName = useRef<string | undefined>(undefined);
    // What a save of the session would leave out. The Save mode shows it before the user saves. It is
    // undefined until the session is checked, and while the session cannot be saved.
    const [saveIssues, setSaveIssues] = useState<WorkspaceIssue[]>();

    const appStore = AppStore.Instance;
    const mode = appStore.dialogStore.workspaceDialogMode;
    const isOpenMode = mode === WorkspaceDialogMode.Open;
    const isSaveMode = mode === WorkspaceDialogMode.Save;
    const saveBlocker = isSaveMode ? appStore.workspaceSaveBlocker : undefined;

    // Find what a save would leave out, and find it again when the session changes. The check only
    // reads the session. It runs at most once in 300 ms, so that a cursor that moves over the image
    // does not run it at every move. The list renders again only when its content changes.
    useEffect(() => {
        if (!isSaveMode) {
            setSaveIssues(undefined);
            return undefined;
        }
        return reaction(
            () => (appStore.workspaceSaveBlocker ? undefined : new WorkspaceSnapshotter().findIssues()),
            issues => setSaveIssues(issues),
            {fireImmediately: true, delay: 300, equals: comparer.structural}
        );
    }, [appStore, isSaveMode]);

    const fetchWorkspaces = useCallback(async () => {
        setIsFetching(true);
        setFetchErrorMessage("");
        try {
            const workspaces = await appStore.apiService.getWorkspaceList();
            setWorkspaceList(workspaces);
        } catch (err) {
            setFetchErrorMessage(err);
        }
        setIsFetching(false);
    }, [appStore]);

    const clearSelection = useCallback(() => {
        selection.current = undefined;
        setPreflight(undefined);
        setReadErrorMessage("");
        setIsReadingWorkspace(false);
    }, []);

    const handleCloseClicked = useCallback(() => {
        appStore.dialogStore.hideDialog(DialogId.Workspace);
        setWorkspaceName("");
        setWorkspaceList(undefined);
        setSearch("");
        setSelectedNames([]);
        clearSelection();
    }, [appStore, clearSelection]);

    /** Read the workspace and check what it needs. The check runs only in the Open mode. */
    const selectWorkspace = useCallback(
        async (entry: WorkspaceListItem) => {
            setWorkspaceName(entry.name);
            setSearch("");
            if (selection.current === entry.name) {
                return;
            }
            selection.current = entry.name;
            setPreflight(undefined);
            setReadErrorMessage("");
            setIsReadingWorkspace(true);
            const workspace = await appStore.apiService.getWorkspace(entry.name);
            if (selection.current !== entry.name) {
                return;
            }
            setIsReadingWorkspace(false);
            if (!workspace) {
                setReadErrorMessage("Could not read the workspace");
                return;
            }
            const store = new WorkspacePreflightStore(entry.name, workspace, workspace.editable !== false && !appStore.isReadOnly);
            setPreflight(store);
            if (appStore.dialogStore.workspaceDialogMode === WorkspaceDialogMode.Open) {
                store.check();
                store.testMirrors();
            }
        },
        [appStore]
    );

    const saveWorkspace = useCallback(
        async (name: string) => {
            if (!name) {
                return;
            }

            if (workspaceList?.some(item => item.name === name)) {
                const isConfirmed = await appStore.alertStore.showInteractiveAlert(`A workspace named "${name}" already exists. Saving replaces it.`);
                if (!isConfirmed) {
                    return;
                }
            }

            setIsFetching(true);
            try {
                const res = await appStore.saveWorkspace(name);
                if (res) {
                    AppToaster.show(SuccessToast("floppy-disk", "Workspace saved"));
                    handleCloseClicked();
                    return;
                }
            } catch (err) {
                console.error(err);
            }
            AppToaster.show(ErrorToast("Error saving workspace"));
            setIsFetching(false);
        },
        [appStore, handleCloseClicked, workspaceList]
    );

    const openWorkspace = useCallback(
        async (name: string) => {
            if (!name) {
                return;
            }

            setIsFetching(true);
            try {
                // Open the workspace as the dialog checked it, with the new locations and without what is still missing.
                const prepared = preflight?.name === name && !preflight.isChecking ? {workspace: preflight.preparedWorkspace, leftOut: preflight.leftOut} : undefined;
                const res = await appStore.loadWorkspace(name, false, prepared);
                if (res) {
                    AppToaster.show(SuccessToast("floppy-disk", "Workspace loaded"));
                    handleCloseClicked();
                    return;
                }
            } catch (err) {
                console.error(err);
            }
            setIsFetching(false);
        },
        [appStore, handleCloseClicked, preflight]
    );

    // The save waits until the session is checked, so that the user sees the list before saving.
    const isSaveCheckDone = !saveBlocker && saveIssues !== undefined;
    const handleSaveClicked = () => {
        if (!isSaveCheckDone || isFetching) {
            return;
        }
        saveWorkspace(workspaceName.trim());
    };

    const isMultiSelected = selectedNames.length > 1;

    const handleDeleteClicked = async () => {
        const names = isMultiSelected ? selectedNames : [workspaceName];
        if (!names.every(name => workspaceList?.some(item => item.name === name))) {
            return;
        }
        const text =
            names.length === 1 ? (
                `Delete the workspace "${names[0]}"? This cannot be undone.`
            ) : (
                <div data-testid="workspace-delete-names">
                    <p>Delete these {names.length} workspaces? This cannot be undone.</p>
                    <ul>
                        {names.slice(0, MAX_LISTED_DELETES).map(name => (
                            <li key={name}>{name}</li>
                        ))}
                        {names.length > MAX_LISTED_DELETES && <li>and {names.length - MAX_LISTED_DELETES} more</li>}
                    </ul>
                </div>
            );
        const isConfirmed = await appStore.alertStore.showInteractiveAlert(text);
        if (isConfirmed) {
            await appStore.deleteWorkspaces(names);
            clearSelection();
            setSelectedNames([]);
            setWorkspaceName("");
            await fetchWorkspaces();
        }
    };

    // A name that the user typed instead of selecting it opens without a check.
    const checkedPreflight = preflight?.name === workspaceName ? preflight : undefined;
    const isCheckDone = !isOpenMode || (!isReadingWorkspace && !checkedPreflight?.isChecking);
    const handleOpenClicked = () => {
        if (!workspaceList?.find(item => item.name === workspaceName) || !isCheckDone || isFetching) {
            return;
        }
        openWorkspace(workspaceName);
    };

    const handleKeyDown = (ev: React.KeyboardEvent<HTMLElement>) => {
        if (ev.key === "Enter" && workspaceName && !isMultiSelected) {
            if (isOpenMode) {
                handleOpenClicked();
            } else {
                handleSaveClicked();
            }
        }
    };

    // Fetch workspaces at start
    useEffect(() => {
        clearSelection();
        setIsFetching(false);
        if (mode !== WorkspaceDialogMode.Hidden) {
            fetchWorkspaces();
        }
    }, [mode, fetchWorkspaces, clearSelection]);

    const sortedWorkspaces = useMemo(() => {
        const text = search.trim().toLowerCase();
        const list = (workspaceList ?? []).filter(item => item.name.toLowerCase().includes(text));
        const direction = sort.isAscending ? 1 : -1;
        return list.sort((a, b) => direction * (sort.key === "name" ? a.name.localeCompare(b.name) : a.date - b.date));
    }, [workspaceList, search, sort]);

    const handleSortClicked = (key: SortKey) => {
        // A new column sorts names from A and dates from the newest.
        setSort(current => (current.key === key ? {key, isAscending: !current.isAscending} : {key, isAscending: key === "name"}));
    };

    /**
     * Selects the workspace of a row. Cmd/Ctrl adds the row to the selection or takes it out. Shift
     * selects the rows from the row clicked last without Shift. The summary shows a workspace only
     * when one workspace is selected.
     */
    const handleRowClicked = (ev: React.MouseEvent, entry: WorkspaceListItem) => {
        const current = isMultiSelected ? selectedNames : workspaceList?.some(item => item.name === workspaceName) ? [workspaceName] : [];
        let names: string[];
        if (ev.metaKey || ev.ctrlKey) {
            names = current.includes(entry.name) ? current.filter(name => name !== entry.name) : [...current, entry.name];
            pivotName.current = entry.name;
        } else if (ev.shiftKey && pivotName.current !== undefined) {
            const rows = sortedWorkspaces.map(item => item.name);
            const from = rows.indexOf(pivotName.current);
            const to = rows.indexOf(entry.name);
            names = from === -1 ? [entry.name] : rows.slice(Math.min(from, to), Math.max(from, to) + 1);
        } else {
            names = [entry.name];
            pivotName.current = entry.name;
        }
        setSelectedNames(names);
        if (names.length === 1) {
            const item = workspaceList?.find(workspace => workspace.name === names[0]);
            if (item) {
                selectWorkspace(item);
            }
        } else {
            clearSelection();
            // The Open mode clears the name, which would name only one of the workspaces. The Save
            // mode keeps it, because the save still uses it.
            if (!names.length || isOpenMode) {
                setWorkspaceName("");
            }
        }
    };

    const handleDoubleClick = (entry: WorkspaceListItem) => {
        if (isMultiSelected) {
            return;
        }
        if (mode === WorkspaceDialogMode.Save) {
            if (isSaveCheckDone && !isFetching) {
                saveWorkspace(entry.name);
            }
        } else if (preflight?.name === entry.name && !preflight.isChecking && !isFetching) {
            openWorkspace(entry.name);
        }
    };

    const className = classNames("workspace-dialog", {[Classes.DARK]: appStore.isDarkTheme});

    const dialogProps: DialogProps = {
        icon: "control",
        backdropClassName: "minimal-dialog-backdrop",
        className: className,
        canOutsideClickClose: false,
        lazy: true,
        isOpen: mode !== WorkspaceDialogMode.Hidden,
        title: mode === WorkspaceDialogMode.Save ? "Save Workspace" : "Open Workspace"
    };

    const sortIcon = (key: SortKey) => (sort.key === key ? <Icon icon={sort.isAscending ? "chevron-up" : "chevron-down"} size={12} /> : null);

    let listContent: React.ReactNode;
    if (isFetching && !workspaceList) {
        listContent = <NonIdealState icon={<Spinner intent="primary" />} title="Loading workspaces" />;
    } else if (fetchErrorMessage) {
        listContent = <NonIdealState icon="error" title="Error" description={fetchErrorMessage} />;
    } else if (!workspaceList?.length) {
        listContent = <NonIdealState icon="search" title="No results" description="There are no workspaces available" />;
    } else if (!sortedWorkspaces.length) {
        listContent = <NonIdealState icon="search" title={`No workspaces match "${search}"`} />;
    } else {
        listContent = (
            // Clicking a row moves the focus to the list. Enter then opens or saves the selected workspace, as it does in the name field.
            <div className="workspace-rows" role="listbox" aria-label="Workspaces" tabIndex={0} onKeyDown={handleKeyDown}>
                {sortedWorkspaces.map(entry => {
                    const isSelected = isMultiSelected ? selectedNames.includes(entry.name) : entry.name === workspaceName;
                    return (
                        <div
                            key={entry.name}
                            role="option"
                            aria-selected={isSelected}
                            className={classNames("workspace-row", {"is-selected": isSelected})}
                            onClick={ev => handleRowClicked(ev, entry)}
                            onDoubleClick={() => handleDoubleClick(entry)}
                            data-testid="workspace-list-row"
                        >
                            <span className="filename-cell" title={entry.name}>
                                {entry.name}
                            </span>
                            <span className="time-cell" data-testid="workspace-list-date">
                                {formatDate(entry.date)}
                            </span>
                        </div>
                    );
                })}
            </div>
        );
    }

    const leftOutCount = checkedPreflight?.leftOutCount ?? 0;
    const openText = !isCheckDone ? "Checking…" : leftOutCount ? `Open without ${leftOutCount} item${leftOutCount === 1 ? "" : "s"}` : "Open";
    const hasSelection = isMultiSelected || !!workspaceList?.some(item => item.name === workspaceName);
    let saveText = "Save";
    if (!saveBlocker && !saveIssues) {
        saveText = "Checking…";
    } else if (!saveBlocker && saveIssues?.length) {
        saveText = `Save without ${saveIssues.length} item${saveIssues.length === 1 ? "" : "s"}`;
    }

    return (
        <DraggableDialogComponent dialogProps={dialogProps} helpType={HelpType.WORKSPACE} defaultWidth={820} defaultHeight={580} minWidth={750} minHeight={550} isResizingEnabled={true} dialogId={DialogId.Workspace}>
            <div className={Classes.DIALOG_BODY}>
                <div className="workspace-container">
                    <div className="workspace-list-container">
                        <div className="workspace-list-header">
                            <button type="button" className="sort-button" onClick={() => handleSortClicked("name")} data-testid="workspace-sort-name">
                                Name {sortIcon("name")}
                            </button>
                            <button type="button" className="sort-button" onClick={() => handleSortClicked("date")} data-testid="workspace-sort-date">
                                Last modified {sortIcon("date")}
                            </button>
                        </div>
                        <div className="workspace-list">{listContent}</div>
                    </div>
                    <div className="workspace-info-container">
                        {isMultiSelected ? (
                            <div className="workspace-info-scroll" data-testid="workspace-multi-selected">
                                <NonIdealState icon="multi-select" title={`${selectedNames.length} workspaces selected`} />
                            </div>
                        ) : workspaceList?.length ? (
                            <div className="workspace-info-scroll">
                                <ScrollShadow>
                                    <WorkspaceInfoComponent preflight={preflight} isFetching={isReadingWorkspace} errorMessage={readErrorMessage} shouldShowChecks={isOpenMode} />
                                </ScrollShadow>
                            </div>
                        ) : null}
                        {isSaveMode && <WorkspaceSaveCheckComponent issues={saveIssues ?? []} blocker={saveBlocker} />}
                    </div>
                </div>
                <InputGroup
                    className="workspace-name-input"
                    placeholder="Enter workspace name"
                    value={workspaceName}
                    autoFocus={true}
                    onChange={(ev: React.ChangeEvent<HTMLInputElement>) => {
                        setSelectedNames([]);
                        setWorkspaceName(ev.currentTarget.value);
                        if (isOpenMode) {
                            setSearch(ev.currentTarget.value);
                        }
                    }}
                    onKeyDown={handleKeyDown}
                />
            </div>
            <div className={Classes.DIALOG_FOOTER}>
                <div className={Classes.DIALOG_FOOTER_ACTIONS}>
                    {isOpenMode && checkedPreflight && <WorkspaceSaveChanges preflight={checkedPreflight} onSaved={fetchWorkspaces} />}
                    <AnchorButton intent={Intent.DANGER} icon="trash" onClick={handleDeleteClicked} text="Delete" disabled={isFetching || !hasSelection || appStore.isReadOnly} />
                    {isOpenMode && checkedPreflight && hasSelection && <WorkspaceOpenInWindow preflight={checkedPreflight} isDisabled={isFetching} onOpened={handleCloseClicked} />}
                    {mode === WorkspaceDialogMode.Save ? (
                        <AnchorButton intent={Intent.PRIMARY} onClick={handleSaveClicked} text={saveText} disabled={isFetching || !workspaceName.trim() || !isSaveCheckDone} data-testid="workspace-save-button" />
                    ) : (
                        <AnchorButton intent={Intent.PRIMARY} onClick={handleOpenClicked} text={openText} disabled={isFetching || !hasSelection || isMultiSelected || !isCheckDone} data-testid="workspace-open-button" />
                    )}
                </div>
            </div>
        </DraggableDialogComponent>
    );
});
