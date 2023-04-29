import * as React from "react";
import {useCallback, useEffect, useState} from "react";
import {AnchorButton, Classes, IDialogProps, InputGroup, Intent, NonIdealState, Spinner} from "@blueprintjs/core";
import {Cell, Column, IRegion, RenderMode, SelectionModes, Table, TableLoadingOption} from "@blueprintjs/table";
import classNames from "classnames";
import {observer} from "mobx-react";
import moment from "moment/moment";

import {DraggableDialogComponent} from "components/Dialogs";
import {WorkspaceListItem} from "models";
import {AppStore, HelpType} from "stores";

import {AppToaster, ErrorToast, SuccessToast} from "../../Shared";

import {WorkspaceInfoComponent} from "./WorkspaceInfoComponent";

import "./WorkspaceDialogComponent.scss";

export enum WorkspaceDialogMode {
    Hidden,
    Save,
    Open
}

export const WorkspaceDialogComponent = observer(() => {
    const [workspaceList, setWorkspaceList] = useState<WorkspaceListItem[]>();
    const [isFetching, setIsFetching] = useState(false);
    const [fetchErrorMessage, setFetchErrorMessage] = useState("");
    const [workspaceName, setWorkspaceName] = useState("");
    const [selectedWorkspace, setSelectedWorkspace] = useState<WorkspaceListItem>();

    const appStore = AppStore.Instance;
    const mode = appStore.dialogStore.workspaceDialogMode;

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

    const handleInput = (ev: React.FormEvent<HTMLInputElement>) => {
        setWorkspaceName(ev.currentTarget.value);
    };

    const handleKeyDown = (ev: React.KeyboardEvent<HTMLInputElement>) => {
        if (ev.key === "Enter" && workspaceName) {
            handleSaveClicked();
        }
    };

    const handleCloseClicked = useCallback(() => {
        appStore.dialogStore.hideWorkspaceDialog();
        setWorkspaceName("");
        setWorkspaceList(undefined);
    }, [appStore]);

    const saveWorkspace = useCallback(
        async (name: string) => {
            if (!name) {
                return;
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
                console.log(err);
            }
            AppToaster.show(ErrorToast("Error saving workspace"));
            setIsFetching(false);
        },
        [appStore, handleCloseClicked]
    );

    const openWorkspace = useCallback(
        async (name: string) => {
            if (!name) {
                return;
            }

            setIsFetching(true);
            try {
                const res = await appStore.loadWorkspace(name);
                if (res) {
                    AppToaster.show(SuccessToast("floppy-disk", "Workspace loaded"));
                    handleCloseClicked();
                    return;
                }
            } catch (err) {
                console.log(err);
            }
            setIsFetching(false);
        },
        [appStore, handleCloseClicked]
    );

    const handleSaveClicked = () => {
        if (!workspaceName) {
            return;
        }
        saveWorkspace(workspaceName);
    };

    const handleDeleteClicked = async () => {
        if (!selectedWorkspace) {
            return;
        }
        const confirmed = await appStore.alertStore.showInteractiveAlert("Are you sure you want to delete this workspace?");
        if (confirmed) {
            await appStore.deleteWorkspace(selectedWorkspace.name);
            await fetchWorkspaces();
        }
    };

    const handleOpenClicked = () => {
        if (!workspaceName || !workspaceList.find(item => item.name === workspaceName)) {
            return;
        }
        openWorkspace(workspaceName);
    };

    // Fetch workspaces at start
    useEffect(() => {
        setSelectedWorkspace(undefined);
        setIsFetching(false);
        if (mode !== WorkspaceDialogMode.Hidden) {
            fetchWorkspaces();
        }
    }, [mode, fetchWorkspaces]);

    const className = classNames("workspace-dialog", {"bp3-dark": appStore.darkTheme});

    const dialogProps: IDialogProps = {
        icon: "control",
        backdropClassName: "minimal-dialog-backdrop",
        className: className,
        canOutsideClickClose: false,
        lazy: true,
        isOpen: mode !== WorkspaceDialogMode.Hidden,
        onClose: appStore.dialogStore.hideWorkspaceDialog,
        title: mode === WorkspaceDialogMode.Save ? "Save Workspace" : "Open Workspace"
    };

    const handleEntryClicked = (entry: WorkspaceListItem) => {
        setWorkspaceName(entry.name);
        setSelectedWorkspace(entry);
    };

    const handleDoubleClick = useCallback(
        (entry: WorkspaceListItem) => {
            if (!entry?.name) {
                return;
            }
            if (mode === WorkspaceDialogMode.Save) {
                saveWorkspace(entry.name);
            } else {
                openWorkspace(entry.name);
            }
        },
        [mode, saveWorkspace, openWorkspace]
    );

    const renderFilenames = useCallback(
        (rowIndex: number) => {
            const entry = workspaceList?.[rowIndex];
            if (!entry) {
                return <Cell loading={true} />;
            }
            return (
                <Cell className="filename-cell" tooltip={entry.name}>
                    <React.Fragment>
                        <div onClick={() => handleEntryClicked(entry)} onDoubleClick={() => handleDoubleClick(entry)}>
                            <span className="cell-text">{entry.name}</span>
                        </div>
                    </React.Fragment>
                </Cell>
            );
        },
        [workspaceList, handleDoubleClick]
    );

    const renderDates = useCallback(
        (rowIndex: number) => {
            const entry = workspaceList?.[rowIndex];
            if (!entry) {
                return <Cell loading={true} />;
            }

            const unixDate = entry.date;
            let dateString: string;
            if (unixDate > 0) {
                const t = moment.unix(unixDate);
                const isToday = moment(0, "HH").diff(t) <= 0;
                if (isToday) {
                    dateString = t.format("HH:mm");
                } else {
                    dateString = t.format("D MMM YYYY");
                }
            }

            return (
                <Cell className="time-cell">
                    <React.Fragment>
                        <div onClick={() => handleEntryClicked(entry)}>
                            <span className="cell-text">{dateString}</span>
                        </div>
                    </React.Fragment>
                </Cell>
            );
        },
        [workspaceList]
    );

    const selectedItemIndex = workspaceList?.findIndex(item => item.name === workspaceName);
    const selectedRegions: IRegion[] = selectedItemIndex >= 0 ? [{rows: [selectedItemIndex, selectedItemIndex]}] : [];

    let tableContent: React.ReactNode;
    if (isFetching) {
        tableContent = <NonIdealState icon={<Spinner intent="primary" />} title="Loading workspaces" />;
    } else if (fetchErrorMessage) {
        tableContent = <NonIdealState icon="error" title="Error" description={fetchErrorMessage} />;
    } else if (!workspaceList?.length) {
        tableContent = <NonIdealState icon="search" title="No results" description="There are no workspaces available" />;
    } else {
        tableContent = (
            <Table
                className={classNames("workspace-table", {"bp3-dark": appStore.darkTheme})}
                enableRowReordering={false}
                renderMode={RenderMode.NONE}
                selectionModes={SelectionModes.ROWS_ONLY}
                selectedRegions={selectedRegions}
                enableGhostCells={false}
                enableMultipleSelection={false}
                enableRowResizing={false}
                columnWidths={[200, 120]}
                defaultRowHeight={22}
                enableRowHeader={false}
                numRows={workspaceList?.length}
                loadingOptions={isFetching ? [TableLoadingOption.CELLS] : []}
            >
                <Column name="Name" cellRenderer={renderFilenames} />
                <Column name="Last modified" cellRenderer={renderDates} />
            </Table>
        );
    }

    return (
        <DraggableDialogComponent dialogProps={dialogProps} helpType={HelpType.SAVE_WORKSPACE} defaultWidth={750} defaultHeight={550} minWidth={750} minHeight={550} enableResizing={true}>
            <div className={Classes.DIALOG_BODY}>
                <div className="workspace-container">
                    <div className="workspace-table-container">{tableContent}</div>
                    <div className="workspace-info-container">{workspaceList?.length ? <WorkspaceInfoComponent workspaceListItem={selectedWorkspace} /> : null}</div>
                </div>
                <InputGroup className="workspace-name-input" placeholder="Enter workspace name" value={workspaceName} autoFocus={true} onChange={handleInput} onKeyDown={handleKeyDown} />
            </div>
            <div className={Classes.DIALOG_FOOTER}>
                <div className={Classes.DIALOG_FOOTER_ACTIONS}>
                    <AnchorButton intent={Intent.WARNING} onClick={handleDeleteClicked} text="Delete" disabled={isFetching || !selectedWorkspace} />
                    {mode === WorkspaceDialogMode.Save ? (
                        <AnchorButton intent={Intent.PRIMARY} onClick={handleSaveClicked} text="Save" disabled={isFetching || !workspaceName} />
                    ) : (
                        <AnchorButton intent={Intent.PRIMARY} onClick={handleOpenClicked} text="Open" disabled={isFetching || !selectedRegions?.length} />
                    )}
                </div>
            </div>
        </DraggableDialogComponent>
    );
});
