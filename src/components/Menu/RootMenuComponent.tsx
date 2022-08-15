import * as React from "react";
import {action, computed, makeObservable, observable} from "mobx";
import {observer} from "mobx-react";
import {Alert, Button, Classes, Icon, Intent, Menu, MenuDivider, Position, Switch} from "@blueprintjs/core";
import {IconName} from "@blueprintjs/icons";
import {MenuItem2, Popover2, Tooltip2} from "@blueprintjs/popover2";
import classNames from "classnames";
import {CARTA} from "carta-protobuf";
import {ToolbarMenuComponent} from "./ToolbarMenu/ToolbarMenuComponent";
import {ExportImageMenuComponent} from "../Shared";
import {CARTA_INFO, PresetLayout, Snippet} from "models";
import {AppStore, BrowserMode, PreferenceKeys, SnippetStore, WidgetsStore, WidgetType} from "stores";
import {FrameStore} from "stores/Frame";
import {ApiService, ConnectionStatus} from "services";
import {toFixed} from "utilities";
import {CustomIcon, CustomIconName} from "icons/CustomIcons";
import "./RootMenuComponent.scss";

@observer
export class RootMenuComponent extends React.Component {
    @observable documentationAlertVisible: boolean;
    @observable disableCheckRelease: boolean = false;

    @action toggleDisableCheckRelease = () => {
        this.disableCheckRelease = !this.disableCheckRelease;
    };

    private documentationAlertTimeoutHandle;

    constructor(props: any) {
        super(props);
        makeObservable(this);
    }

    private handleDashboardClicked = () => {
        window.open(ApiService.RuntimeConfig.dashboardAddress, "_blank");
    };

    private handleWidgetExecuteClicked = async (ev: React.MouseEvent<HTMLElement>, snippet: Snippet, name: string) => {
        ev.stopPropagation();
        const snippetStore = SnippetStore.Instance;
        if (snippet?.code) {
            snippetStore.setActiveSnippet(snippet, name);
            await snippetStore.executeCurrentSnippet();
        }
    };

    private genWidgetsMenu = () => {
        const cartaWidgets = WidgetsStore.Instance.CARTAWidgets;
        const regionListConfig = cartaWidgets.get(WidgetType.Region);
        const imageListConfig = cartaWidgets.get(WidgetType.ImageList);
        const cursorInfoConfig = cartaWidgets.get(WidgetType.CursorInfo);
        const logConfig = cartaWidgets.get(WidgetType.Log);
        const spatialProfilerConfig = cartaWidgets.get(WidgetType.SpatialProfiler);
        const spectralProfilerConfig = cartaWidgets.get(WidgetType.SpectralProfiler);
        const restWidgets = Array.from(cartaWidgets.keys()).filter(widget => ![WidgetType.Region, WidgetType.ImageList, WidgetType.CursorInfo, WidgetType.Log, WidgetType.SpatialProfiler, WidgetType.SpectralProfiler].includes(widget));

        return (
            <Menu className="widgets-menu">
                <MenuItem2 text="Info Panels" icon={"panel-stats"}>
                    <MenuItem2 text={WidgetType.Region} icon={<CustomIcon icon={regionListConfig.icon as CustomIconName} />} onClick={regionListConfig.onClick} />
                    <MenuItem2 text={WidgetType.ImageList} icon={imageListConfig.icon as IconName} onClick={imageListConfig.onClick} />
                    <MenuItem2 text={WidgetType.CursorInfo} icon={<CustomIcon icon={cursorInfoConfig.icon as CustomIconName} />} onClick={cursorInfoConfig.onClick} />
                    <MenuItem2 text={WidgetType.Log} icon={logConfig.icon as IconName} onClick={logConfig.onClick} />
                </MenuItem2>
                <MenuItem2 text="Profiles" icon={"pulse"}>
                    <MenuItem2 text={WidgetType.SpatialProfiler} icon={<CustomIcon icon={spatialProfilerConfig.icon as CustomIconName} />} onClick={spatialProfilerConfig.onClick} />
                    <MenuItem2 text={WidgetType.SpectralProfiler} icon={<CustomIcon icon={spectralProfilerConfig.icon as CustomIconName} />} onClick={spectralProfilerConfig.onClick} />
                </MenuItem2>
                {restWidgets.map(widgetType => {
                    const widgetConfig = cartaWidgets.get(widgetType);
                    const trimmedStr = widgetType.replace(/\s+/g, "");
                    return (
                        <MenuItem2 key={`${trimmedStr}Menu`} text={widgetType} icon={widgetConfig.isCustomIcon ? <CustomIcon icon={widgetConfig.icon as CustomIconName} /> : (widgetConfig.icon as IconName)} onClick={widgetConfig.onClick} />
                    );
                })}
            </Menu>
        );
    };

    private recurseSnippetMap(snippetMap: Map<string, any>): React.ReactNode[] {
        let nodes = [];
        for (const [name, node] of snippetMap) {
            // Create menu and recurse
            if (node instanceof Map) {
                nodes.push(
                    <MenuItem2 key={name} text={name}>
                        {this.recurseSnippetMap(node)}
                    </MenuItem2>
                );
            } else {
                nodes.push(node);
            }
        }
        // Sort nodes as follows:
        // - Folders first (sorted alphabetically)
        // - Items sorted alphabetically
        return nodes.sort((a, b) => {
            const lengthA = a.props?.children?.length ?? 0;
            const lengthB = b.props?.children?.length ?? 0;
            if ((lengthA > 0 && lengthB > 0) || lengthA === lengthB) {
                return a.key > b.key ? 1 : -1;
            }
            return Math.sign(lengthB - lengthA);
        });
    }

    private newReleaseButtonOnClick = () => {
        const appStore = AppStore.Instance;
        if (this.disableCheckRelease) {
            appStore.preferenceStore.setPreference(PreferenceKeys.CHECK_NEW_RELEASE, false);
        }
        appStore.preferenceStore.setPreference(PreferenceKeys.LATEST_RELEASE, appStore.newRelease);
        appStore.setShowNewRelease(false);
    };

    @computed get snippetsMenu() {
        const appStore = AppStore.Instance;
        if (!appStore.preferenceStore.codeSnippetsEnabled) {
            return null;
        }

        const snippetObj = new Map<string, any>();

        for (const [name, snippet] of appStore.snippetStore.snippets) {
            // Skip hidden snippets
            if (snippet?.categories?.includes("hidden")) {
                continue;
            }

            const labelElement = (
                <Button className="snippet-run-button" small={true} minimal={true} icon={"play"} intent="success" disabled={appStore.snippetStore.isExecuting} onClick={ev => this.handleWidgetExecuteClicked(ev, snippet, name)} />
            );

            const menuItem = <MenuItem2 key={name} text={name} icon={labelElement} onClick={() => appStore.dialogStore.showExistingCodeSnippet(snippet, name)} />;

            if (snippet.categories?.length) {
                for (const category of snippet.categories) {
                    const categoryParts = category.split("/");
                    let menuRoot = snippetObj;
                    for (const folder of categoryParts) {
                        if (!menuRoot.has(folder)) {
                            menuRoot.set(folder, new Map<string, any>());
                        }
                        menuRoot = menuRoot.get(folder);
                    }
                    menuRoot.set(name, menuItem);
                }
            } else {
                snippetObj.set(name, menuItem);
            }
        }

        const snippetEntries = this.recurseSnippetMap(snippetObj);
        return (
            <Menu>
                {snippetEntries}
                {snippetEntries.length > 0 && <MenuDivider />}
                <MenuItem2 text="Create new snippet" icon="add" onClick={appStore.dialogStore.showNewCodeSnippet} />
            </Menu>
        );
    }

    render() {
        const appStore = AppStore.Instance;
        const modString = appStore.modifierString;
        const connectionStatus = appStore.backendService.connectionStatus;

        let serverMenu: React.ReactNode[] = [];

        const apiService = appStore.apiService;
        if (apiService.authenticated && ApiService.RuntimeConfig.apiAddress) {
            serverMenu.push(<MenuItem2 key="restart" text="Restart Service" disabled={!appStore.apiService.authenticated} onClick={appStore.apiService.stopServer} />);
        }
        if (ApiService.RuntimeConfig.logoutAddress || ApiService.RuntimeConfig.googleClientId) {
            serverMenu.push(<MenuItem2 key="logout" text="Logout" disabled={!appStore.apiService.authenticated} onClick={appStore.apiService.logout} />);
        }
        if (ApiService.RuntimeConfig.dashboardAddress) {
            serverMenu.push(<MenuItem2 key="dashboard" text="Dashboard" onClick={this.handleDashboardClicked} />);
        }

        let serverSubMenu: React.ReactNode;
        if (serverMenu.length) {
            serverSubMenu = (
                <React.Fragment>
                    <MenuDivider />
                    <MenuItem2 text="Server">{serverMenu}</MenuItem2>
                </React.Fragment>
            );
        }

        const fileMenu = (
            <Menu>
                <MenuItem2 text="Open image" label={`${modString}O`} disabled={appStore.openFileDisabled} onClick={() => appStore.fileBrowserStore.showFileBrowser(BrowserMode.File, false)} />
                <MenuItem2 text="Append image" label={`${modString}L`} disabled={appStore.appendFileDisabled} onClick={() => appStore.fileBrowserStore.showFileBrowser(BrowserMode.File, true)} />
                <Tooltip2 content={"not allowed in read-only mode"} disabled={appStore.appendFileDisabled || appStore.backendService?.serverFeatureFlags !== CARTA.ServerFeatureFlags.READ_ONLY} position={Position.LEFT}>
                    <MenuItem2
                        text="Save image"
                        label={`${modString}S`}
                        disabled={appStore.appendFileDisabled || appStore.backendService?.serverFeatureFlags === CARTA.ServerFeatureFlags.READ_ONLY}
                        onClick={() => appStore.fileBrowserStore.showFileBrowser(BrowserMode.SaveFile, false)}
                    />
                </Tooltip2>
                <MenuItem2 text="Close image" label={`${modString}W`} disabled={appStore.appendFileDisabled} onClick={() => appStore.closeCurrentFile(true)} />
                <MenuDivider />
                <MenuItem2 text="Import regions" disabled={!appStore.activeFrame} onClick={() => appStore.fileBrowserStore.showFileBrowser(BrowserMode.RegionImport, false)} />
                <Tooltip2
                    content={"not allowed in read-only mode"}
                    disabled={!appStore.activeFrame || !appStore.activeFrame.regionSet.regions || appStore.activeFrame.regionSet.regions.length <= 1 || appStore.backendService?.serverFeatureFlags !== CARTA.ServerFeatureFlags.READ_ONLY}
                    position={Position.LEFT}
                >
                    <MenuItem2
                        text="Export regions"
                        disabled={!appStore.activeFrame || !appStore.activeFrame.regionSet.regions || appStore.activeFrame.regionSet.regions.length <= 1 || appStore.backendService.serverFeatureFlags === CARTA.ServerFeatureFlags.READ_ONLY}
                        onClick={() => appStore.fileBrowserStore.showExportRegions()}
                    />
                </Tooltip2>
                <MenuDivider />
                <MenuItem2 text="Import catalog" label={`${modString}G`} disabled={appStore.appendFileDisabled} onClick={() => appStore.fileBrowserStore.showFileBrowser(BrowserMode.Catalog, false)} />
                <MenuDivider />
                <MenuItem2 text="Export image" disabled={!appStore.activeFrame || appStore.isExportingImage}>
                    <ExportImageMenuComponent />
                </MenuItem2>
                <MenuItem2 text="Preferences" onClick={appStore.dialogStore.showPreferenceDialog} disabled={appStore.preferenceStore.supportsServer && connectionStatus !== ConnectionStatus.ACTIVE} />
                {serverSubMenu}
            </Menu>
        );

        let layerItems = appStore.frames.map(frame => {
            return <MenuItem2 text={frame.filename} active={appStore.activeFrame && appStore.activeFrame.frameInfo.fileId === frame.frameInfo.fileId} key={frame.frameInfo.fileId} onClick={() => this.handleFrameSelect(frame)} />;
        });

        const presetLayouts: string[] = PresetLayout.PRESETS;
        const layoutStore = appStore.layoutStore;
        const userLayouts: string[] = layoutStore.userLayoutNames;

        const viewMenu = (
            <Menu>
                <MenuItem2 text="Theme" icon={"media"}>
                    <MenuItem2 text="Automatic" icon={"contrast"} onClick={appStore.setAutoTheme} />
                    <MenuItem2 text="Light" icon={"flash"} onClick={appStore.setLightTheme} />
                    <MenuItem2 text="Dark" icon={"moon"} onClick={appStore.setDarkTheme} />
                </MenuItem2>
                <MenuItem2 text="Layouts" icon={"page-layout"} disabled={layoutStore.supportsServer && connectionStatus !== ConnectionStatus.ACTIVE}>
                    <MenuItem2 text="Existing Layouts" disabled={!presetLayouts && !userLayouts}>
                        {presetLayouts &&
                            presetLayouts.length > 0 &&
                            presetLayouts.map(value => <MenuItem2 key={value} text={value} active={value === appStore.layoutStore.currentLayoutName} onClick={() => appStore.layoutStore.applyLayout(value)} />)}
                        {userLayouts && userLayouts.length > 0 && (
                            <React.Fragment>
                                <MenuDivider />
                                {userLayouts.map(value => (
                                    <MenuItem2 key={value} text={value} active={value === appStore.layoutStore.currentLayoutName} onClick={() => appStore.layoutStore.applyLayout(value)} />
                                ))}
                            </React.Fragment>
                        )}
                    </MenuItem2>
                    <MenuItem2 text="Save Layout" onClick={appStore.dialogStore.showSaveLayoutDialog} />
                    <MenuItem2 text="Delete Layout" disabled={!userLayouts || userLayouts.length <= 0}>
                        {userLayouts &&
                            userLayouts.length > 0 &&
                            userLayouts.map(value => (
                                <MenuItem2
                                    key={value}
                                    text={value}
                                    active={value === appStore.layoutStore.currentLayoutName}
                                    onClick={() => {
                                        appStore.layoutStore.deleteLayout(value);
                                        if (value === appStore.preferenceStore.layout) {
                                            appStore.preferenceStore.setPreference(PreferenceKeys.GLOBAL_LAYOUT, PresetLayout.DEFAULT);
                                        }
                                    }}
                                />
                            ))}
                    </MenuItem2>
                </MenuItem2>
                {layerItems.length > 0 && (
                    <MenuItem2 text="Images" icon={"multi-select"}>
                        {layerItems}
                        <MenuDivider />
                        <MenuItem2 text="Previous image" icon={"step-backward"} disabled={layerItems.length < 2} onClick={appStore.prevFrame} />
                        <MenuItem2 text="Next image" icon={"step-forward"} disabled={layerItems.length < 2} onClick={appStore.nextFrame} />
                    </MenuItem2>
                )}
                <MenuItem2 text="File header" icon={"app-header"} disabled={!appStore.activeFrame} onClick={appStore.dialogStore.showFileInfoDialog} />
                <MenuItem2 text="Contours" icon={<CustomIcon icon="contour" />} disabled={!appStore.activeFrame} onClick={appStore.dialogStore.showContourDialog} />
                <MenuItem2 text="Vector overlay" icon={<CustomIcon icon="vectorOverlay" />} disabled={!appStore.activeFrame} onClick={appStore.dialogStore.showVectorOverlayDialog} />
                <MenuItem2 text="Image fitting" icon={<CustomIcon icon="imageFitting" />} disabled={!appStore.activeFrame} onClick={appStore.dialogStore.showFittingDialog} />
                <MenuItem2 text="Online Catalog Query" icon="geosearch" disabled={!appStore.activeFrame} onClick={appStore.dialogStore.showCatalogQueryDialog} />
                {appStore.preferenceStore.codeSnippetsEnabled && <MenuItem2 text="Code snippets" icon={"console"} onClick={appStore.dialogStore.showCodeSnippetDialog} />}
            </Menu>
        );

        const helpMenu = (
            <Menu>
                <MenuItem2 text="Online Manual" icon={"manual"} onClick={this.handleDocumentationClicked} />
                <MenuItem2 text="Controls and Shortcuts" icon={"key-control"} label={"Shift + ?"} onClick={appStore.dialogStore.showHotkeyDialog} />
                <MenuItem2 text="About" icon={"info-sign"} onClick={appStore.dialogStore.showAboutDialog} />
            </Menu>
        );

        let connectivityClass = "connectivity-icon";
        let connectivityTooltip;
        const latencyString = isFinite(appStore.backendService.endToEndPing) ? `${toFixed(appStore.backendService.endToEndPing, 1)} ms` : "Unknown";
        const userString = appStore.username ? ` as ${appStore.username}` : "";
        switch (connectionStatus) {
            case ConnectionStatus.PENDING:
                connectivityTooltip = <span>Connecting to server{userString}</span>;
                connectivityClass += " warning";
                break;
            case ConnectionStatus.ACTIVE:
                if (appStore.backendService.connectionDropped) {
                    connectivityTooltip = (
                        <span>
                            Reconnected to server {userString} after disconnect. Some errors may occur
                            <br />
                            <i>
                                <small>Latency: {latencyString}</small>
                            </i>
                        </span>
                    );
                    connectivityClass += " warning";
                } else {
                    connectivityTooltip = (
                        <span>
                            Connected to server {userString}
                            <br />
                            <i>
                                <small>
                                    Latency: {latencyString}
                                    <br />
                                    Session ID: {appStore.backendService.sessionId}
                                </small>
                            </i>
                        </span>
                    );
                    connectivityClass += " online";
                }
                break;
            case ConnectionStatus.CLOSED:
            default:
                connectivityTooltip = <span>Disconnected from server</span>;
                connectivityClass += " offline";
                break;
        }

        const tilesLoading = appStore.tileService.remainingTiles > 0;
        const contoursLoading = appStore.activeFrame?.contourProgress >= 0 && appStore.activeFrame.contourProgress < 1;
        const vectorOverlayLoading = appStore.activeFrame?.vectorOverlayStore.progress >= 0 && appStore.activeFrame.vectorOverlayStore.progress < 1;
        let loadingTooltipFragment;
        let loadingIndicatorClass = "contour-loading-icon";
        let showLoadingIndicator = false;

        if (tilesLoading || contoursLoading || vectorOverlayLoading) {
            let tilesTooltipContent;
            if (tilesLoading) {
                tilesTooltipContent = <span>Streaming image tiles. {appStore.tileService.remainingTiles} remaining</span>;
            }
            let contourTooltipContent;
            if (contoursLoading) {
                contourTooltipContent = <span>Streaming contours. {toFixed(100 * appStore.activeFrame.contourProgress, 1)}% complete</span>;
            }

            let vectorOverlayTooltipContent;
            if (vectorOverlayLoading) {
                vectorOverlayTooltipContent = <span>Streaming vector overlay. {toFixed(100 * appStore.activeFrame.vectorOverlayStore.progress, 1)}% complete</span>;
            }

            loadingTooltipFragment = (
                <React.Fragment>
                    {tilesTooltipContent}
                    {contoursLoading && tilesLoading && <br />}
                    {contourTooltipContent}
                    {vectorOverlayTooltipContent}
                </React.Fragment>
            );

            showLoadingIndicator = true;
        }

        let loadingIndicator;
        if (loadingTooltipFragment) {
            loadingIndicator = (
                <Tooltip2 content={loadingTooltipFragment}>
                    <Icon icon={"cloud-download"} className={loadingIndicatorClass} />
                </Tooltip2>
            );
        } else {
            loadingIndicator = <Icon icon={"cloud-download"} className={loadingIndicatorClass} />;
        }

        const newReleaseMessage = (
            <div className={classNames(Classes.ALERT, "new-release", {"bp4-dark": appStore.darkTheme})}>
                <div className={Classes.ALERT_BODY}>
                    <img src="carta_logo.png" />
                    <div className={Classes.ALERT_CONTENTS}>
                        <p>A new {appStore.newRelease.includes("beta") ? "beta" : ""} release is available!</p>
                        <p>
                            Visit the{" "}
                            <a href="https://cartavis.org" rel="noopener noreferrer" target="_blank">
                                CARTA homepage
                            </a>{" "}
                            for more details.
                        </p>
                        <div className="release-info">
                            <p>Current release: v{CARTA_INFO.version}</p>
                            <p>New release: {appStore.newRelease}</p>
                        </div>
                    </div>
                </div>
                <div className={Classes.ALERT_FOOTER}>
                    <Button intent={Intent.PRIMARY} text="OK" onClick={this.newReleaseButtonOnClick} />
                    <Switch checked={this.disableCheckRelease} onChange={this.toggleDisableCheckRelease} label="Don't show new releases again." />
                </div>
            </div>
        );

        return (
            <div className="root-menu">
                <Popover2 autoFocus={false} minimal={true} content={fileMenu} position={Position.BOTTOM_LEFT}>
                    <Menu className="root-menu-entry">
                        <MenuItem2 text="File" />
                    </Menu>
                </Popover2>
                <Popover2 autoFocus={false} minimal={true} content={viewMenu} position={Position.BOTTOM_LEFT}>
                    <Menu className="root-menu-entry">
                        <MenuItem2 text="View" />
                    </Menu>
                </Popover2>
                <Popover2 autoFocus={false} minimal={true} content={this.genWidgetsMenu()} position={Position.BOTTOM_LEFT}>
                    <Menu className="root-menu-entry">
                        <MenuItem2 text="Widgets" />
                    </Menu>
                </Popover2>
                {appStore.preferenceStore.codeSnippetsEnabled && (
                    <Popover2 autoFocus={false} minimal={true} content={this.snippetsMenu} position={Position.BOTTOM_LEFT}>
                        <Menu className="root-menu-entry">
                            <MenuItem2 text="Snippets" />
                        </Menu>
                    </Popover2>
                )}
                <Popover2 autoFocus={false} minimal={true} content={helpMenu} position={Position.BOTTOM_LEFT}>
                    <Menu className="root-menu-entry">
                        <MenuItem2 text="Help" />
                    </Menu>
                </Popover2>
                <ToolbarMenuComponent />
                <Alert className={appStore.darkTheme ? "bp4-dark" : ""} isOpen={this.documentationAlertVisible} onClose={this.handleAlertDismissed} canEscapeKeyCancel={true} canOutsideClickCancel={true} confirmButtonText={"Dismiss"}>
                    Documentation will open in a new tab. Please ensure any popup blockers are disabled.
                </Alert>
                {appStore.showNewRelease && (
                    <Popover2 content={newReleaseMessage} position={Position.BOTTOM_RIGHT}>
                        <Tooltip2 content="New release available!" position={Position.BOTTOM_RIGHT}>
                            <Button icon={"envelope"} intent={"warning"} minimal={true} />
                        </Tooltip2>
                    </Popover2>
                )}
                {showLoadingIndicator && loadingIndicator}
                {appStore.preferenceStore.lowBandwidthMode && (
                    <Tooltip2
                        content={
                            <span>
                                CARTA is running in low bandwidth mode
                                <br />
                                <i>
                                    <small>Image resolution and cursor responsiveness will be reduced</small>
                                </i>
                            </span>
                        }
                    >
                        <Icon icon={"feed"} className="connectivity-icon warning" />
                    </Tooltip2>
                )}
                {appStore.snippetStore.isExecuting && (
                    <Tooltip2 content="CARTA is currently executing a code snippet.">
                        <Icon icon={"console"} intent={"warning"} />
                    </Tooltip2>
                )}
                <Tooltip2 content={connectivityTooltip}>
                    <Icon icon={"symbol-circle"} className={connectivityClass} />
                </Tooltip2>
                <div id="hidden-status-info">
                    <span id="info-session-id">{appStore.backendService.sessionId}</span>
                </div>
            </div>
        );
    }

    handleDocumentationClicked = () => {
        window.open("https://carta.readthedocs.io/en/3.0", "_blank", "width=1024");
        if (process.env.REACT_APP_TARGET !== "linux" && process.env.REACT_APP_TARGET !== "darwin") {
            this.documentationAlertVisible = true;
            clearTimeout(this.documentationAlertTimeoutHandle);
            this.documentationAlertTimeoutHandle = setTimeout(() => (this.documentationAlertVisible = false), 10000);
        }
    };

    handleAlertDismissed = () => {
        this.documentationAlertVisible = false;
    };

    handleFrameSelect = (frame: FrameStore) => {
        const appStore = AppStore.Instance;
        if (appStore.activeFrame && appStore.activeFrame === frame) {
            return;
        } else {
            appStore.setActiveFrame(frame);
        }
    };
}
