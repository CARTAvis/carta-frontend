import * as React from "react";
import {Button, ButtonGroup, HTMLSelect, Icon, type IconName, Intent, Tooltip} from "@blueprintjs/core";
import {observer} from "mobx-react";

import {type CatalogDatabase, WorkspaceItemKind} from "enums";
import {AppStore, MirrorSiteStore, WorkspaceRecoveryAction, type WorkspaceRecoveryItem, type WorkspaceRecoveryStore} from "stores";

import {FileName, FileNameText} from "../WorkspaceRestoreReportDialog/FileNameText";

/** Returns the host of a mirror URL, such as simbad.cds.unistra.fr, or the whole URL when it cannot be parsed. */
function mirrorLabel(url: string): string {
    try {
        return new URL(url).host;
    } catch {
        return url;
    }
}

/** Lets the user choose the mirror that a retry sends the query to. The Online Data Query dialog uses the same choice. */
const MirrorSelect = observer(({database}: {database: CatalogDatabase}) => {
    const mirrorSiteStore = MirrorSiteStore.Instance;
    const mirrors = mirrorSiteStore.getMirrorSites(database).filter(url => !mirrorSiteStore.isMirrorUnavailable(database, url));
    if (mirrors.length < 2) {
        return null;
    }
    return (
        <Tooltip content="The mirror that a retry asks">
            <HTMLSelect
                minimal
                options={mirrors.map(url => ({value: url, label: mirrorLabel(url)}))}
                value={mirrorSiteStore.getActiveMirror(database)}
                onChange={event => mirrorSiteStore.setActiveMirror(database, event.currentTarget.value)}
                data-testid="workspace-recovery-mirror-select"
            />
        </Tooltip>
    );
});

/** Returns the icon of the kind of an item, such as an image or a catalog. */
function iconOf(item: WorkspaceRecoveryItem): IconName {
    switch (item.kind) {
        case WorkspaceItemKind.Catalog:
            return "th";
        case WorkspaceItemKind.GeneratedImage:
            return "layers";
        default:
            return "media";
    }
}

/**
 * Lists the items of a restore stage that failed. For each item, the user chooses to open it from
 * another file, to open it again as it is saved, or to skip it. Skipping an item names what goes
 * with it.
 */
export const WorkspaceRecoveryComponent = observer(({recovery}: {recovery: WorkspaceRecoveryStore}) => {
    const fileBrowserStore = AppStore.Instance.fileBrowserStore;

    const chooseFile = async (index: number, kind: "image" | "catalog") => {
        const location = await fileBrowserStore.pickFile(kind);
        if (location) {
            recovery.setChoice(index, {action: WorkspaceRecoveryAction.Repoint, location});
        }
    };

    const undecided = recovery.items.filter((_, index) => !recovery.choiceOf(index)).length;

    return (
        <div className="workspace-recovery" data-testid="workspace-recovery">
            <div className="recovery-header">
                <span className="restore-stage">{recovery.stage}</span>
                <span className="recovery-status" data-testid="workspace-recovery-status">
                    {undecided === 0 ? "Ready to continue" : `${undecided === 1 ? "1 item needs" : `${undecided} items need`} a decision`}
                </span>
            </div>
            <ul role="list">
                {recovery.items.map((item, index) => {
                    const choice = recovery.choiceOf(index);
                    const isChosen = (action: WorkspaceRecoveryAction) => choice?.action === action;
                    return (
                        <li key={index} className="recovery-item" data-testid="workspace-recovery-item">
                            <div className="recovery-text">
                                <div className="recovery-label">
                                    <Icon icon={iconOf(item)} size={14} />
                                    <FileNameText text={item.label && item.reason ? item.label : item.message} subject={item.subject} label={item.label} />
                                </div>
                                {item.label && item.reason && (
                                    <div className="recovery-reason">
                                        <FileNameText text={item.reason} subject={item.subject} label={item.label} />
                                    </div>
                                )}
                                {choice?.action === WorkspaceRecoveryAction.Repoint && (
                                    <div className="recovery-note recovery-location" data-testid="workspace-recovery-location">
                                        <Icon icon="arrow-right" size={12} />
                                        <span>
                                            Opens <FileName text={choice.location.filename} />
                                            {choice.location.hdu ? ` (HDU ${choice.location.hdu})` : ""}
                                            {choice.location.directory ? (
                                                <>
                                                    {" "}
                                                    in <FileName text={choice.location.directory} />
                                                </>
                                            ) : (
                                                " in the top-level folder"
                                            )}
                                        </span>
                                    </div>
                                )}
                                {choice?.action === WorkspaceRecoveryAction.Skip && item.dependents.length > 0 && (
                                    <div className="recovery-note" data-testid="workspace-recovery-dependents">
                                        Skipping it also leaves out {item.dependents.join(", ")}.
                                    </div>
                                )}
                            </div>
                            <div className="recovery-actions">
                                <ButtonGroup>
                                    {item.repointKind && (
                                        <Button
                                            size="small"
                                            icon="folder-open"
                                            active={isChosen(WorkspaceRecoveryAction.Repoint)}
                                            intent={isChosen(WorkspaceRecoveryAction.Repoint) ? Intent.PRIMARY : Intent.NONE}
                                            onClick={() => chooseFile(index, item.repointKind!)}
                                            data-testid="workspace-recovery-repoint-button"
                                        >
                                            Choose file…
                                        </Button>
                                    )}
                                    {item.canRetry && (
                                        <Button
                                            size="small"
                                            icon="refresh"
                                            active={isChosen(WorkspaceRecoveryAction.Retry)}
                                            intent={isChosen(WorkspaceRecoveryAction.Retry) ? Intent.PRIMARY : Intent.NONE}
                                            onClick={() => recovery.setChoice(index, {action: WorkspaceRecoveryAction.Retry})}
                                            data-testid="workspace-recovery-retry-button"
                                        >
                                            Retry
                                        </Button>
                                    )}
                                    <Button
                                        size="small"
                                        icon="step-forward"
                                        active={isChosen(WorkspaceRecoveryAction.Skip)}
                                        intent={isChosen(WorkspaceRecoveryAction.Skip) ? Intent.PRIMARY : Intent.NONE}
                                        onClick={() => recovery.setChoice(index, {action: WorkspaceRecoveryAction.Skip})}
                                        data-testid="workspace-recovery-skip-button"
                                    >
                                        Skip
                                    </Button>
                                </ButtonGroup>
                                {item.database && <MirrorSelect database={item.database} />}
                            </div>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
});
