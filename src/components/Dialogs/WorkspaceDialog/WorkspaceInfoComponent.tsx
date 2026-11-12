import * as React from "react";
import {useEffect, useState} from "react";
import {Alert, AnchorButton, Button, Classes, HTMLSelect, Icon, type IconName, Intent, NonIdealState, Overlay2, Spinner, Tag, Tooltip, Tree, type TreeNodeInfo} from "@blueprintjs/core";
import classNames from "classnames";
import {observer} from "mobx-react";

import {AppToaster, WarningToast} from "components/Shared";
import {type CatalogDatabase} from "enums";
import {AppStore, MirrorSiteStore} from "stores";
import {formatSize, isSameSize, workspaceWindowUrl} from "stores/Workspace/WorkspaceFieldOfView";
import {type WorkspaceCheckedFile, type WorkspaceCheckLevel, type WorkspaceFileStatus, type WorkspacePreflightStore} from "stores/Workspace/WorkspacePreflightStore";

import "./WorkspaceInfoComponent.scss";

/** How the status of a file reads, and its color. */
const FILE_STATUS: Record<WorkspaceFileStatus, {text: string; intent: Intent}> = {
    checking: {text: "Checking", intent: Intent.NONE},
    found: {text: "Found", intent: Intent.SUCCESS},
    missing: {text: "Missing", intent: Intent.DANGER},
    moved: {text: "New location", intent: Intent.WARNING},
    region: {text: "Region", intent: Intent.NONE}
};

/** Returns the host of a mirror, such as simbad.u-strasbg.fr, or the whole URL when it cannot be read. */
function hostOf(url: string): string {
    try {
        return new URL(url).host;
    } catch {
        return url;
    }
}

/** Returns "1 region" or "3 regions". */
function countOf(count: number, noun: string): string {
    return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

/** The status tag of a row. */
const StatusTag = (props: {text: string; intent: Intent; testId: string}) => (
    <Tag minimal intent={props.intent} className="status-tag" data-testid={props.testId}>
        {props.text}
    </Tag>
);

/** The icon of a group or a combined image, by its level. Red marks what the workspace opens without, and orange what it checks only when it opens. */
const LevelIcon = (props: {level: WorkspaceCheckLevel; text?: string}) => {
    const icon =
        props.level === "checking" ? (
            <Spinner size={14} />
        ) : props.level === "left-out" ? (
            <Icon icon="error" intent={Intent.DANGER} />
        ) : props.level === "attention" ? (
            <Icon icon="warning-sign" intent={Intent.WARNING} />
        ) : (
            <Icon icon="tick-circle" intent={Intent.SUCCESS} />
        );
    return (
        <span className={classNames("level-icon", `is-${props.level}`)} data-testid="workspace-info-level" data-level={props.level}>
            {icon}
            {props.text && <span className="level-text">{props.text}</span>}
        </span>
    );
};

/** Returns the size of the browser viewport, and updates it when the window changes size. */
function useViewportSize(): {width: number; height: number} {
    const [size, setSize] = useState({width: window.innerWidth, height: window.innerHeight});
    useEffect(() => {
        const update = () => setSize({width: window.innerWidth, height: window.innerHeight});
        window.addEventListener("resize", update);
        return () => window.removeEventListener("resize", update);
    }, []);
    return size;
}

interface FolderMove {
    from: string;
    to: string;
    files: WorkspaceCheckedFile[];
}

/**
 * The summary of the workspace selected in the Workspace dialog: its images and their regions, its
 * catalogs, and the other settings that it restores. In the Open mode, it also shows whether each
 * file is found, and lets the user choose new locations for missing files and other mirrors.
 */
export const WorkspaceInfoComponent = observer((props: {preflight?: WorkspacePreflightStore; isFetching: boolean; errorMessage?: string; shouldShowChecks: boolean}) => {
    const {preflight, shouldShowChecks} = props;
    const [folderMove, setFolderMove] = useState<FolderMove>();
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    // The nodes that the user opened or closed. A group with a red mark opens by itself until the user closes it.
    const [toggled, setToggled] = useState<Map<string, boolean>>(new Map());
    const appStore = AppStore.Instance;
    const viewport = useViewportSize();

    useEffect(() => setToggled(new Map()), [preflight]);

    if (props.isFetching) {
        return <NonIdealState className="workspace-info" icon={<Spinner />} title="Reading the workspace" />;
    } else if (props.errorMessage) {
        return <NonIdealState className="workspace-info" icon="error" title={props.errorMessage} />;
    } else if (!preflight) {
        return <NonIdealState className="workspace-info" icon="folder-open" title="No workspace selected" />;
    }

    const locate = async (file: WorkspaceCheckedFile) => {
        const oldDirectory = preflight.directoryOf(file);
        const location = await appStore.fileBrowserStore.pickFile(file.kind);
        if (!location) {
            return;
        }
        preflight.setLocation(file, {directory: location.directory, filename: location.filename, hdu: location.hdu});
        const move = preflight.getFolderMove(file, oldDirectory);
        if (move.files.length && move.from !== move.to) {
            setFolderMove(move);
        } else {
            preflight.check();
        }
    };

    const endFolderMove = (shouldMove: boolean) => {
        if (folderMove && shouldMove) {
            preflight.moveFolder(folderMove);
        }
        setFolderMove(undefined);
        preflight.check();
    };

    const fileRow = (file: WorkspaceCheckedFile, label: React.ReactNode, isPart: boolean) => {
        const status = preflight.statusOf(file);
        // A name that is not a file is a region of the expression. It is not listed.
        if (status === "region") {
            return null;
        }
        return (
            <div key={file.key} className={classNames("summary-row", {"is-part": isPart})} data-testid="workspace-info-file">
                <Tooltip className="row-name" content={preflight.pathOf(file)} placement="top-start" hoverOpenDelay={300}>
                    <span>{label}</span>
                </Tooltip>
                {shouldShowChecks && <StatusTag {...FILE_STATUS[status]} testId="workspace-info-file-status" />}
                {shouldShowChecks && <span className="row-action">{status === "missing" && <AnchorButton size="small" text="Locate" onClick={() => locate(file)} data-testid="workspace-info-locate-button" />}</span>}
            </div>
        );
    };

    // The details are on a second line, so that a long name does not hide them.
    const nameWithDetails = (name: string, details: (string | undefined)[]) => {
        const text = details.filter(Boolean).join(" · ");
        return (
            <span className="name-with-details">
                <span className="row-title">{name}</span>
                {text && <span className="row-details">{text}</span>}
            </span>
        );
    };

    const mirrorRow = (catalogId: number, name: string, database: CatalogDatabase) => {
        const mirror = preflight.mirrors.get(database);
        if (!mirror) {
            return null;
        }
        const mirrorSiteStore = MirrorSiteStore.Instance;
        const mirrors = mirrorSiteStore.getMirrorSites(database).filter(site => !mirrorSiteStore.isMirrorUnavailable(database, site));
        const isNew = mirror.chosen !== mirror.saved && mirror.saved !== undefined;
        const status =
            mirror.state === "testing"
                ? {text: "Testing", intent: Intent.NONE}
                : mirror.state === "no-answer"
                  ? {text: "No answer", intent: Intent.DANGER}
                  : {text: isNew ? "New mirror" : "Answered", intent: isNew ? Intent.WARNING : Intent.SUCCESS};
        return (
            <div key={catalogId} className="summary-row" data-testid="workspace-info-online-catalog">
                {/* The mirror is on a second line, so that a long name does not hide it. */}
                <span className="row-name is-stacked">
                    <span>{name}</span>
                    {shouldShowChecks && (
                        <span className="mirror-line">
                            <span className="row-details">Mirror</span>
                            <HTMLSelect
                                className="mirror-select"
                                value={mirror.chosen}
                                options={mirrors.map(site => ({value: site, label: hostOf(site)}))}
                                onChange={ev => preflight.testMirror(database, ev.currentTarget.value)}
                                data-testid="workspace-info-mirror-select"
                            />
                        </span>
                    )}
                </span>
                {shouldShowChecks && <StatusTag {...status} testId="workspace-info-mirror-status" />}
                {shouldShowChecks && (
                    <span className="row-action">
                        <AnchorButton size="small" text="Test" disabled={mirror.state === "testing"} onClick={() => preflight.testMirror(database, mirror.chosen)} data-testid="workspace-info-mirror-test-button" />
                    </span>
                )}
            </div>
        );
    };

    const images = preflight.images;
    const catalogs = preflight.catalogs;

    const isExpanded = (id: string, level: WorkspaceCheckLevel, isOpenByDefault = false) => toggled.get(id) ?? (isOpenByDefault || (shouldShowChecks && level === "left-out"));
    const toggleNode = (node: TreeNodeInfo) => {
        if (node.hasCaret) {
            setToggled(new Map(toggled).set(String(node.id), !node.isExpanded));
        }
    };
    const leaf = (id: string, row: React.JSX.Element): TreeNodeInfo => ({id, label: row, className: "summary-node"});

    const imageNodes: TreeNodeInfo[] = images.flatMap(image => {
        const label = nameWithDetails(image.name, [image.references, image.regionCount ? countOf(image.regionCount, "region") : undefined]);
        if (image.isGenerated) {
            return [
                leaf(
                    `image-${image.id}`,
                    <div className="summary-row" data-testid="workspace-info-generated-image">
                        <span className="row-name">{label}</span>
                        {shouldShowChecks && <StatusTag text="Made again" intent={Intent.PRIMARY} testId="workspace-info-generated-status" />}
                        {shouldShowChecks && <span className="row-action" />}
                    </div>
                )
            ];
        }
        if (!image.hasParts) {
            return image.files.flatMap(file => {
                const row = fileRow(file, label, false);
                return row ? [leaf(file.key, row)] : [];
            });
        }
        const id = `image-${image.id}`;
        const level = preflight.levelOfImage(image);
        const parts = image.files.flatMap(file => {
            const row = fileRow(file, file.filename, true);
            return row ? [leaf(file.key, row)] : [];
        });
        return [
            {
                id,
                hasCaret: parts.length > 0,
                isExpanded: isExpanded(id, level),
                className: "summary-node",
                label: (
                    <div className="summary-row" data-testid="workspace-info-combined-image">
                        <span className="row-name">{label}</span>
                        {shouldShowChecks && (image.isCheckedWhenOpened ? <StatusTag text="Checked when opened" intent={Intent.WARNING} testId="workspace-info-file-status" /> : <LevelIcon level={level} />)}
                        {shouldShowChecks && <span className="row-action" />}
                    </div>
                ),
                childNodes: parts
            }
        ];
    });
    const catalogNodes: TreeNodeInfo[] = catalogs.flatMap(catalog => {
        const row = catalog.file ? fileRow(catalog.file, catalog.name, false) : catalog.database !== undefined ? mirrorRow(catalog.id, catalog.name, catalog.database) : null;
        return row ? [leaf(`catalog-${catalog.id}`, row)] : [];
    });

    const leftOutImages = images.filter(image => preflight.levelOfImage(image) === "left-out").length;
    const attentionImages = images.filter(image => preflight.levelOfImage(image) === "attention").length;
    const missingCatalogs = catalogs.filter(catalog => catalog.file && preflight.levelOfCatalog(catalog) === "left-out").length;
    const hasMirrorNoAnswer = catalogs.some(catalog => !catalog.file && preflight.levelOfCatalog(catalog) === "left-out");
    const summaryOf = (level: WorkspaceCheckLevel, parts: string[]) => (level === "checking" ? "Checking" : parts.filter(Boolean).join(", ") || "All found");
    // A group without a level has nothing to check. By default, it shows its contents until the user closes it.
    const groupNode = (id: string, icon: IconName, title: string, count: number, level: WorkspaceCheckLevel | undefined, summary: string, childNodes: TreeNodeInfo[], isOpenByDefault = level === undefined): TreeNodeInfo => ({
        id,
        hasCaret: true,
        isExpanded: isExpanded(id, level ?? "ok", isOpenByDefault),
        icon,
        className: "summary-group",
        label: (
            <div className="summary-row is-group" data-testid={`workspace-info-${id}`}>
                <span className="row-name">
                    {title}
                    <span className="row-details"> ({count})</span>
                </span>
                {shouldShowChecks && level !== undefined && <LevelIcon level={level} text={summary} />}
            </div>
        ),
        childNodes
    });
    // The browser window that the workspace was saved in. A user who wants the same picture can
    // change the window until it matches. The rows follow the window as it changes size. The group
    // opens by itself when a value is not the same, to the pixel.
    const savedWindow = shouldShowChecks ? preflight.savedWindow : undefined;
    let differentWindowRows = 0;
    const windowRow = (id: string, name: string, saved: string, current: string, isSame: boolean, tooltip: string) => {
        if (!isSame) {
            differentWindowRows++;
        }
        return leaf(
            id,
            <div className="summary-row" data-testid={`workspace-info-${id}`}>
                <Tooltip className="row-name" content={<div className="window-tooltip">{tooltip}</div>} placement="top-start" hoverOpenDelay={300}>
                    {nameWithDetails(name, [`Saved ${saved}`, `now ${current}`])}
                </Tooltip>
                <StatusTag text={isSame ? "Same" : "Different"} intent={isSame ? Intent.SUCCESS : Intent.WARNING} testId={`workspace-info-${id}-status`} />
                <span className="row-action" />
            </div>
        );
    };
    const windowNodes: TreeNodeInfo[] = [];
    if (savedWindow) {
        windowNodes.push(
            windowRow(
                "window-size",
                "Size",
                formatSize(savedWindow.viewport),
                formatSize(viewport),
                isSameSize(savedWindow.viewport, viewport),
                "The size of the browser window, without its toolbars, when the workspace was saved. Change the window to this size, or open the workspace in a new window of this size, to see the images as they were saved."
            )
        );
    }
    const isWindowSame = differentWindowRows === 0;

    const treeNodes: TreeNodeInfo[] = [
        ...(images.length
            ? [
                  groupNode(
                      "images",
                      "media",
                      "Images",
                      images.length,
                      preflight.imagesLevel,
                      summaryOf(preflight.imagesLevel, [leftOutImages ? `${leftOutImages} missing` : "", attentionImages ? `${attentionImages} checked when opened` : ""]),
                      imageNodes
                  )
              ]
            : []),
        ...(catalogs.length
            ? [
                  groupNode(
                      "catalogs",
                      "th",
                      "Catalogs",
                      catalogs.length,
                      preflight.catalogsLevel,
                      summaryOf(preflight.catalogsLevel, [missingCatalogs ? `${missingCatalogs} missing` : "", hasMirrorNoAnswer ? "mirror does not answer" : ""]),
                      catalogNodes
                  )
              ]
            : []),
        ...(savedWindow ? [groupNode("window", "application", "Browser window", windowNodes.length, isWindowSame ? "ok" : "attention", isWindowSame ? "Same as saved" : "Not the same as saved", windowNodes, !isWindowSame)] : []),
        ...(preflight.restoredSettings.length
            ? [
                  groupNode("settings", "settings", "Others", preflight.restoredSettings.length, undefined, "", [
                      leaf(
                          "settings-list",
                          <div className="restored-settings" data-testid="workspace-info-settings">
                              {preflight.restoredSettings.map(setting => (
                                  <Tag key={setting} minimal className="setting-tag">
                                      {setting}
                                  </Tag>
                              ))}
                          </div>
                      )
                  ])
              ]
            : [])
    ];

    return (
        <div className="workspace-info" data-testid="workspace-info">
            <div className="summary-header">
                {preflight.thumbnail ? (
                    <button type="button" className="workspace-thumbnail" onClick={() => setIsPreviewOpen(true)} data-testid="workspace-info-thumbnail">
                        <img src={preflight.thumbnail} alt={`The screen when "${preflight.name}" was saved`} />
                    </button>
                ) : (
                    <div className="workspace-thumbnail is-empty" data-testid="workspace-info-thumbnail">
                        <Icon icon="media" size={20} />
                    </div>
                )}
                <div className="summary-title">
                    <div className="summary-name">{preflight.name}</div>
                    <div className="summary-counts" data-testid="workspace-info-counts">
                        {[countOf(images.length, "image"), countOf(catalogs.length, "catalog"), countOf(preflight.regionCount, "region")].join(" · ")}
                    </div>
                </div>
            </div>
            {treeNodes.length > 0 && <Tree className="summary-tree" contents={treeNodes} onNodeClick={toggleNode} onNodeExpand={toggleNode} onNodeCollapse={toggleNode} />}
            {/* The larger preview has no frame. A click anywhere or the Escape key closes it. */}
            <Overlay2 isOpen={isPreviewOpen && !!preflight.thumbnail} onClose={() => setIsPreviewOpen(false)} hasBackdrop={false} transitionDuration={300}>
                <div className="workspace-preview-overlay" onClick={() => setIsPreviewOpen(false)} data-testid="workspace-info-preview">
                    <img src={preflight.thumbnail} alt={`The screen when "${preflight.name}" was saved`} />
                </div>
            </Overlay2>
            <Alert
                className={classNames({[Classes.DARK]: appStore.isDarkTheme})}
                isOpen={!!folderMove}
                confirmButtonText={folderMove ? `Move ${folderMove.files.length} more` : undefined}
                cancelButtonText="Only this file"
                intent={Intent.PRIMARY}
                onConfirm={() => endFolderMove(true)}
                onCancel={() => endFolderMove(false)}
            >
                {folderMove && (
                    <>
                        <p>
                            {countOf(folderMove.files.length, "other missing file")} {folderMove.files.length === 1 ? "is" : "are"} under the same folder. Move {folderMove.files.length === 1 ? "it" : "them"} the same way?
                        </p>
                        <p className="folder-move">
                            {folderMove.from || "/"} → {folderMove.to || "/"}
                        </p>
                    </>
                )}
            </Alert>
        </div>
    );
});

/**
 * The button that saves the new locations and mirrors that the user chose in the Workspace dialog.
 * It shows only while there are changes. The dialog puts it beside its Delete and Open buttons, so
 * that a long summary does not hide it.
 */
export const WorkspaceSaveChanges = observer((props: {preflight: WorkspacePreflightStore; onSaved?: () => void}) => {
    const {preflight} = props;
    if (!preflight.canSave || !preflight.changeDescriptions.length) {
        return null;
    }
    return (
        <Tooltip
            content={
                <div className="change-list">
                    {preflight.changeDescriptions.map(text => (
                        <div key={text}>{text}</div>
                    ))}
                </div>
            }
            placement="top"
        >
            <Button icon="floppy-disk" text="Save changes" loading={preflight.isSaving} onClick={async () => (await preflight.saveChanges()).state === "written" && props.onSaved?.()} data-testid="workspace-info-save-button" />
        </Tooltip>
    );
});

/**
 * The button that opens the workspace in a new window of the size that it was saved in. The dialog
 * puts it beside its Open button. It shows only while the size of this window is not the same.
 *
 * A page cannot change the size of its own window, but it can open a new window of a given size.
 * The new window starts a new session that opens the stored workspace. New locations that are not
 * saved yet are not in the stored workspace, so the button waits until the user saves them. When the
 * workspace cannot be saved, the button opens the stored workspace without them.
 *
 * @param isDisabled - whether the dialog is busy, for example while it opens the workspace here.
 */
export const WorkspaceOpenInWindow = observer((props: {preflight: WorkspacePreflightStore; isDisabled?: boolean; onOpened?: () => void}) => {
    const {preflight} = props;
    const viewport = useViewportSize();
    const savedWindow = preflight.savedWindow;
    if (!savedWindow || isSameSize(savedWindow.viewport, viewport)) {
        return null;
    }
    const {width, height} = savedWindow.viewport;
    const size = formatSize(savedWindow.viewport);
    const hasUnsavedChanges = preflight.changeDescriptions.length > 0;
    const shouldSaveFirst = hasUnsavedChanges && preflight.canSave;
    // The browser makes a window smaller when it does not fit on the screen. The size of the window
    // includes its title bar and borders, so add those of this window to the saved viewport.
    const borderWidth = Math.max(0, window.outerWidth - window.innerWidth);
    const borderHeight = Math.max(0, window.outerHeight - window.innerHeight);
    const isLargerThanScreen = width + borderWidth > window.screen.availWidth || height + borderHeight > window.screen.availHeight;
    const notes = [
        `Open the workspace in a new ${size} window, the size it was saved in. This window stays open.`,
        hasUnsavedChanges && !preflight.canSave ? "The new window opens the stored workspace, without the new locations chosen here." : "",
        preflight.leftOutCount > 0 ? "The new window checks the missing files again." : "",
        isLargerThanScreen ? "The screen is smaller than this size, so the browser makes the window smaller." : ""
    ];
    const open = () => {
        const opened = window.open(workspaceWindowUrl(window.location.href, preflight.name), "_blank", `popup,width=${Math.round(width)},height=${Math.round(height)}`);
        if (!opened) {
            AppToaster.show(WarningToast("The browser blocked the new window. Allow pop-ups for CARTA, and try again."));
            return;
        }
        if (isLargerThanScreen) {
            AppToaster.show(WarningToast(`The screen is smaller than ${size}, so the new window is smaller than when the workspace was saved.`));
        }
        props.onOpened?.();
    };
    return (
        <Tooltip
            content={
                <div className="window-tooltip">{props.isDisabled ? "The workspace is opening in this window." : shouldSaveFirst ? "Save the changes first. The new window opens the stored workspace." : notes.filter(Boolean).join(" ")}</div>
            }
            placement="top"
        >
            <AnchorButton icon="share" text={`Open in ${size} window`} disabled={shouldSaveFirst || props.isDisabled} onClick={open} data-testid="workspace-open-window-button" />
        </Tooltip>
    );
});
