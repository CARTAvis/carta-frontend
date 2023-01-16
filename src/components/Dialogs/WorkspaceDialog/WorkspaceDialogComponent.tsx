import * as React from "react";
import {useCallback, useEffect, useState} from "react";
import classNames from "classnames";
import {observer} from "mobx-react";
import moment from "moment/moment";
import {AnchorButton, InputGroup, IDialogProps, Button, Intent, Classes, NonIdealState, Spinner} from "@blueprintjs/core";
import {Tooltip2} from "@blueprintjs/popover2";
import {Cell, Column, RenderMode, SelectionModes, Table, TableLoadingOption} from "@blueprintjs/table";
import {DraggableDialogComponent} from "components/Dialogs";
import {AppStore, HelpType} from "stores";
import {WorkspaceListItem} from "models";
import "./WorkspaceDialogComponent.scss";

export const WorkspaceDialogComponent = observer(() => {
    const [workspaceList, setWorkspaceList] = useState<WorkspaceListItem[]>();
    const [isFetching, setIsFetching] = useState(false);
    const [fetchErrorMessage, setFetchErrorMessage] = useState("");
    const [workspaceName, setWorkspaceName] = useState("");

    const appStore = AppStore.Instance;

    const fetchWorkspaces = useCallback(async () => {
        setIsFetching(true);
        setFetchErrorMessage("");

        try {
            const workspaces = await appStore.apiService.getWorkspaceList();
            console.log(workspaces);
            setWorkspaceList(workspaces);
        } catch (err) {
            setFetchErrorMessage(err);
        }
        setIsFetching(false);
    }, [appStore.apiService]);

    const handleInput = (ev: React.FormEvent<HTMLInputElement>) => {
        setWorkspaceName(ev.currentTarget.value);
    };

    const handleKeyDown = (ev: React.KeyboardEvent<HTMLInputElement>) => {
        if (ev.key === "Enter" && workspaceName) {
            handleSaveClicked();
        }
    };

    const handleCloseClicked = () => {
        appStore.dialogStore.hideSaveWorkspaceDialog();
        setWorkspaceName("");
        setWorkspaceList(undefined);
    };

    const handleSaveClicked = () => {
        // TODO: actually save worksapce
    };

    // Fetch workspaces at start
    useEffect(() => {
        if (appStore.dialogStore.saveWorkspaceDialogVisible) {
            fetchWorkspaces();
        }
    }, [appStore.dialogStore.saveWorkspaceDialogVisible, fetchWorkspaces]);

    const className = classNames("workspace-dialog", {"bp3-dark": appStore.darkTheme});

    const dialogProps: IDialogProps = {
        icon: "layout-grid",
        backdropClassName: "minimal-dialog-backdrop",
        className: className,
        canOutsideClickClose: false,
        lazy: true,
        isOpen: appStore.dialogStore.saveWorkspaceDialogVisible,
        onClose: appStore.dialogStore.hideSaveWorkspaceDialog,
        title: "Save Workspace"
    };

    const handleEntryClicked = (entry: WorkspaceListItem) => {
        setWorkspaceName(entry.name);
    };

    const renderFilenames = useCallback(
        (rowIndex: number) => {
            const entry = workspaceList?.[rowIndex];
            if (!entry) {
                return <Cell loading={true} />;
            }
            return (
                <Cell className="filename-cell" tooltip={entry.name}>
                    <React.Fragment>
                        <div onClick={() => handleEntryClicked(entry)}>
                            <span className="cell-text">{entry.name}</span>
                        </div>
                    </React.Fragment>
                </Cell>
            );
        },
        [workspaceList]
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
                className={classNames("browser-table", {"bp3-dark": appStore.darkTheme})}
                enableRowReordering={false}
                renderMode={RenderMode.NONE}
                selectionModes={SelectionModes.NONE}
                enableGhostCells={false}
                enableMultipleSelection={false}
                enableRowResizing={false}
                columnWidths={[260, 120]}
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
        <DraggableDialogComponent dialogProps={dialogProps} helpType={HelpType.SAVE_WORKSPACE} defaultWidth={400} defaultHeight={400} minWidth={425} minHeight={400} enableResizing={true}>
            <div className={Classes.DIALOG_BODY}>
                <div className="workspace-table-container">{tableContent}</div>
                <InputGroup className="workspace-name-input" placeholder="Enter workspace name" value={workspaceName} autoFocus={true} onChange={handleInput} onKeyDown={handleKeyDown} />
            </div>
            <div className={Classes.DIALOG_FOOTER}>
                <div className={Classes.DIALOG_FOOTER_ACTIONS}>
                    <Tooltip2 content="Workspace name cannot be empty!" disabled={!workspaceName}>
                        <AnchorButton intent={Intent.PRIMARY} onClick={handleSaveClicked} text="Save" disabled={!workspaceName} />
                    </Tooltip2>
                    <Button intent={Intent.NONE} text="Close" onClick={handleCloseClicked} />
                </div>
            </div>
        </DraggableDialogComponent>
    );
});
