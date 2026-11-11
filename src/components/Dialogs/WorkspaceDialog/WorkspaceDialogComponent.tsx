import * as React from "react";
import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {AnchorButton, Classes, type DialogProps, Icon, InputGroup, Intent, NonIdealState, Spinner} from "@blueprintjs/core";
import classNames from "classnames";
import {observer} from "mobx-react";
import type {WorkspaceListItem} from "models";
import moment from "moment/moment";

import {DraggableDialogComponent} from "components/Dialogs";
import {DialogId, HelpType, WorkspaceDialogMode} from "enums";
import {AppStore} from "stores";
import {WorkspacePreflightStore} from "stores/Workspace/WorkspacePreflightStore";

import {AppToaster, ErrorToast, SuccessToast} from "../../Shared";

import {WorkspaceInfoComponent, WorkspaceSaveChanges} from "./WorkspaceInfoComponent";

import "./WorkspaceDialogComponent.scss";

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

    const appStore = AppStore.Instance;
    const mode = appStore.dialogStore.workspaceDialogMode;
    const isOpenMode = mode === WorkspaceDialogMode.Open;

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
            const store = new WorkspacePreflightStore(entry.name, workspace, workspace.editable !== false);
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

    const handleSaveClicked = () => {
        saveWorkspace(workspaceName.trim());
    };

    const handleDeleteClicked = async () => {
        const name = workspaceName;
        if (!workspaceList?.some(item => item.name === name)) {
            return;
        }
        const isConfirmed = await appStore.alertStore.showInteractiveAlert(`Delete the workspace "${name}"? This cannot be undone.`);
        if (isConfirmed) {
            await appStore.deleteWorkspace(name);
            clearSelection();
            setWorkspaceName("");
            await fetchWorkspaces();
        }
    };

    // A name that the user typed instead of selecting it opens without a check.
    const checkedPreflight = preflight?.name === workspaceName ? preflight : undefined;
    const isCheckDone = !isOpenMode || (!isReadingWorkspace && !checkedPreflight?.isChecking);
    const handleOpenClicked = () => {
        if (!workspaceList?.find(item => item.name === workspaceName) || !isCheckDone) {
            return;
        }
        openWorkspace(workspaceName);
    };

    const handleKeyDown = (ev: React.KeyboardEvent<HTMLInputElement>) => {
        if (ev.key === "Enter" && workspaceName) {
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

    const handleDoubleClick = (entry: WorkspaceListItem) => {
        if (mode === WorkspaceDialogMode.Save) {
            saveWorkspace(entry.name);
        } else if (preflight?.name === entry.name && !preflight.isChecking) {
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
            <div className="workspace-rows" role="listbox" aria-label="Workspaces">
                {sortedWorkspaces.map(entry => {
                    const isSelected = entry.name === workspaceName;
                    return (
                        <div
                            key={entry.name}
                            role="option"
                            aria-selected={isSelected}
                            className={classNames("workspace-row", {"is-selected": isSelected})}
                            onClick={() => selectWorkspace(entry)}
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
    const hasSelection = !!workspaceList?.some(item => item.name === workspaceName);

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
                        {workspaceList?.length ? <WorkspaceInfoComponent preflight={preflight} isFetching={isReadingWorkspace} errorMessage={readErrorMessage} shouldShowChecks={isOpenMode} /> : null}
                    </div>
                </div>
                <InputGroup
                    className="workspace-name-input"
                    placeholder="Enter workspace name"
                    value={workspaceName}
                    autoFocus={true}
                    onChange={(ev: React.ChangeEvent<HTMLInputElement>) => {
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
                    <AnchorButton intent={Intent.DANGER} icon="trash" onClick={handleDeleteClicked} text="Delete" disabled={isFetching || !hasSelection} />
                    {mode === WorkspaceDialogMode.Save ? (
                        <AnchorButton intent={Intent.PRIMARY} onClick={handleSaveClicked} text="Save" disabled={isFetching || !workspaceName.trim()} />
                    ) : (
                        <AnchorButton intent={Intent.PRIMARY} onClick={handleOpenClicked} text={openText} disabled={isFetching || !hasSelection || !isCheckDone} data-testid="workspace-open-button" />
                    )}
                </div>
            </div>
        </DraggableDialogComponent>
    );
});
