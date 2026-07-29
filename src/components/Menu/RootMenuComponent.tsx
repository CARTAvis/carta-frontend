import * as React from "react";
import {Alert, AnchorButton, Button, Classes, Icon, Intent, Menu, MenuDivider, MenuItem, PopoverNext, Position, Switch, Tooltip} from "@blueprintjs/core";
import type {IconName} from "@blueprintjs/icons";
import {CARTA} from "carta-protobuf";
import classNames from "classnames";
import {action, computed, makeObservable, observable} from "mobx";
import {observer} from "mobx-react";

import {copyToClipboardWithToast, ExportImageMenuComponent} from "components/Shared";
import {AnimationMode, BrowserMode, ConnectionStatus, DialogId, ImageType, PreferenceKeys, WidgetType, WorkspaceDialogMode} from "enums";
import {CustomIcon, type CustomIconName} from "icons/CustomIcons";
import {CARTA_INFO, type ImageViewItem, type Snippet} from "models";
import {ApiService} from "services";
import {AppStore, SnippetStore, WidgetsStore} from "stores";
import {toFixed} from "utilities";

import {ToolbarMenuComponent} from "./ToolbarMenu/ToolbarMenuComponent";

import "./RootMenuComponent.scss";

@observer
export class RootMenuComponent extends React.Component {
    @observable isDocumentationAlertVisible: boolean = false;
    @observable isCheckReleaseDisabled: boolean = false;

    @action toggleDisableCheckRelease = () => {
        this.isCheckReleaseDisabled = !this.isCheckReleaseDisabled;
    };

    private documentationAlertTimeoutHandle: ReturnType<typeof setTimeout> | undefined;

    constructor(props: any) {
        super(props);
        makeObservable(this);
    }

    componentWillUnmount() {
        clearTimeout(this.documentationAlertTimeoutHandle);
        this.documentationAlertTimeoutHandle = undefined;
    }

    private handleDashboardClicked = () => {
        window.open(ApiService.runtimeConfig.dashboardAddress, "_blank");
    };

    private formTimeSeries = () => {
        const appStore = AppStore.Instance;
        const eligibleFrames = appStore.frames.filter(appStore.timeSeriesStore.canBeMember);
        if (eligibleFrames.length < 2 || appStore.timeSeriesStore.elements.length > 1) {
            return;
        }

        appStore.animatorStore.stopAnimation();
        appStore.setTimeSeriesMembers(eligibleFrames, true);
        appStore.animatorStore.setAnimationMode(AnimationMode.TIME_SERIES);

        const widgetsStore = appStore.widgetsStore;
        const animatorType = widgetsStore.CARTAWidgets.get(WidgetType.Animator)?.widgetConfig.type;
        if (!animatorType || widgetsStore.selectDockedWidgetTab(animatorType)) {
            return;
        }

        const floatingAnimator = widgetsStore.floatingWidgets.find(widget => widget.type === animatorType);
        if (floatingAnimator) {
            widgetsStore.selectFloatingWidget(floatingAnimator.id);
        } else {
            widgetsStore.createFloatingAnimatorWidget();
        }
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
                <MenuItem text="Info Panels" icon={"panel-stats"}>
                    {regionListConfig && <MenuItem text={WidgetType.Region} icon={<CustomIcon icon={regionListConfig.icon as CustomIconName} />} onClick={regionListConfig.onClick} />}
                    {imageListConfig && <MenuItem text={WidgetType.ImageList} icon={imageListConfig.icon as IconName} onClick={imageListConfig.onClick} />}
                    {cursorInfoConfig && <MenuItem text={WidgetType.CursorInfo} icon={<CustomIcon icon={cursorInfoConfig.icon as CustomIconName} />} onClick={cursorInfoConfig.onClick} />}
                    {logConfig && <MenuItem text={WidgetType.Log} icon={logConfig.icon as IconName} onClick={logConfig.onClick} />}
                </MenuItem>
                <MenuItem text="Profiles" icon={"pulse"}>
                    {spatialProfilerConfig && <MenuItem text={WidgetType.SpatialProfiler} icon={<CustomIcon icon={spatialProfilerConfig.icon as CustomIconName} />} onClick={spatialProfilerConfig.onClick} />}
                    {spectralProfilerConfig && <MenuItem text={WidgetType.SpectralProfiler} icon={<CustomIcon icon={spectralProfilerConfig.icon as CustomIconName} />} onClick={spectralProfilerConfig.onClick} />}
                </MenuItem>
                {restWidgets.map(widgetType => {
                    const widgetConfig = cartaWidgets.get(widgetType);
                    const trimmedStr = widgetType.replace(/\s+/g, "");
                    return (
                        <MenuItem
                            key={`${trimmedStr}Menu`}
                            text={widgetType}
                            icon={widgetConfig?.isCustomIcon ? <CustomIcon icon={widgetConfig.icon as CustomIconName} /> : (widgetConfig?.icon as IconName)}
                            onClick={widgetConfig?.onClick}
                        />
                    );
                })}
            </Menu>
        );
    };

    private recurseSnippetMap(snippetMap: Map<string, any>): React.ReactNode[] {
        const nodes: React.ReactNode[] = [];
        for (const [name, node] of snippetMap) {
            // Create menu and recurse
            if (node instanceof Map) {
                nodes.push(
                    <MenuItem key={name} text={name}>
                        {this.recurseSnippetMap(node)}
                    </MenuItem>
                );
            } else {
                nodes.push(node);
            }
        }
        // Sort nodes as follows:
        // - Folders first (sorted alphabetically)
        // - Items sorted alphabetically
        return nodes.sort((a: any, b: any) => {
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
        if (this.isCheckReleaseDisabled) {
            appStore.preferenceStore.setPreference(PreferenceKeys.CHECK_NEW_RELEASE, false);
        }
        appStore.preferenceStore.setPreference(PreferenceKeys.LATEST_RELEASE, appStore.newRelease);
        appStore.setShowNewRelease(false);
    };

    @computed get snippetsMenu() {
        const appStore = AppStore.Instance;
        if (!appStore.preferenceStore.isCodeSnippetsEnabled) {
            return null;
        }

        const snippetObj = new Map<string, any>();

        for (const [name, snippet] of appStore.snippetStore.snippets) {
            // Skip hidden snippets
            if (snippet?.categories?.includes("hidden")) {
                continue;
            }

            const labelElement = (
                <Button className="snippet-run-button" size="small" variant="minimal" icon={"play"} intent="success" disabled={appStore.snippetStore.isExecuting} onClick={ev => this.handleWidgetExecuteClicked(ev, snippet, name)} />
            );

            const menuItem = <MenuItem key={name} text={name} icon={labelElement} onClick={() => appStore.dialogStore.showDialog(DialogId.Snippet, {snippet: snippet, name: name, newSnippet: false})} />;

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
                <MenuItem text="Create New Snippet" icon="add" onClick={() => appStore.dialogStore.showDialog(DialogId.Snippet, {newSnippet: true})} />
                <MenuItem text="Online Tutorial" icon={"manual"} onClick={() => this.handleDocumentationClicked("https://cartavis.org/carta-frontend/docs/category/code-snippet-tutorial")} />
            </Menu>
        );
    }

    render() {
        const appStore = AppStore.Instance;
        const modString = appStore.modifierString;
        const connectionStatus = appStore.backendService.connectionStatus;

        const serverMenu: React.ReactNode[] = [];

        const apiService = appStore.apiService;
        if (apiService.authenticated && ApiService.runtimeConfig.dashboardAddress) {
            serverMenu.push(<MenuItem key="restart" text="Restart Service" disabled={!appStore.apiService.authenticated} onClick={appStore.apiService.stopServer} />);
        }
        if (ApiService.runtimeConfig.logoutAddress) {
            serverMenu.push(<MenuItem key="logout" text="Logout" disabled={!appStore.apiService.authenticated} onClick={appStore.apiService.logout} />);
        }
        if (ApiService.runtimeConfig.dashboardAddress) {
            serverMenu.push(<MenuItem key="dashboard" text="Dashboard" onClick={this.handleDashboardClicked} />);
        }
        serverMenu.push(
            <MenuItem
                key="copy-id"
                text="Copy session ID to clipboard"
                onClick={async () => {
                    try {
                        await copyToClipboardWithToast(appStore.backendService.sessionId.toString(), "Session ID copied!");
                    } catch (err) {
                        console.error(err);
                    }
                }}
            />
        );
        serverMenu.push(
            <MenuItem
                key="copy-url"
                text="Copy session URL to clipboard"
                onClick={async () => {
                    try {
                        const url = new URL(document.URL);
                        if (url.protocol.startsWith("file")) {
                            const socketUrl = url.searchParams.get("socketUrl");
                            const token = url.searchParams.get("token");
                            const httpUrl = socketUrl?.replace("ws", "http");
                            const finalUrl = `${httpUrl}?token=${token}`;
                            await copyToClipboardWithToast(finalUrl, "Session URL copied!");
                        } else {
                            await copyToClipboardWithToast(document.URL, "Session URL copied!");
                        }
                    } catch (err) {
                        console.error(err);
                    }
                }}
            />
        );
        let serverSubMenu: React.ReactNode;
        if (serverMenu.length) {
            serverSubMenu = (
                <React.Fragment>
                    <MenuItem text="Server">{serverMenu}</MenuItem>
                </React.Fragment>
            );
        }

        let saveImageTooltip: string | React.JSX.Element = "";
        let shouldHideImageTooltip = true;
        if (appStore.backendService?.serverFeatureFlags === CARTA.ServerFeatureFlags.READ_ONLY) {
            saveImageTooltip = "Not allowed in read-only mode";
            shouldHideImageTooltip = false;
        } else if (appStore.activeImage?.type !== ImageType.FRAME) {
            saveImageTooltip = (
                <span>
                    Color-blending and PV preview images cannot be saved.
                    <br />
                    <small>To save color-blending images, please save as a workspace via the File menu.</small>
                </span>
            );
            shouldHideImageTooltip = false;
        }

        const multiColorBlendingTooltip = appStore.frameNum < 1 ? "At least one image is required." : "Create a multi-color blending image from spatially matched images.";
        const eligibleTimeSeriesFrameCount = appStore.frames.filter(appStore.timeSeriesStore.canBeMember).length;
        const hasTimeSeriesSlider = appStore.timeSeriesStore.elements.length > 1;
        const formTimeSeriesTooltip = hasTimeSeriesSlider
            ? "A time series has already been formed."
            : eligibleTimeSeriesFrameCount < 2
              ? "At least two images with a valid DATE-OBS or MJD-OBS are required."
              : "Add all images with a valid DATE-OBS or MJD-OBS to a time series and open Animator.";
        const fileMenu = (
            <Menu>
                <MenuItem text="Open Image" label={`${modString}O`} disabled={appStore.isOpenFileDisabled} onClick={() => appStore.fileBrowserStore.showFileBrowser(BrowserMode.File, false)} />
                <MenuItem text="Append Image" label={`${modString}L`} disabled={appStore.isAppendFileDisabled} onClick={() => appStore.fileBrowserStore.showFileBrowser(BrowserMode.File, true)} />
                <Tooltip content={saveImageTooltip} disabled={shouldHideImageTooltip} position={Position.LEFT}>
                    <MenuItem
                        text="Save Image"
                        label={`${modString}S`}
                        disabled={appStore.isAppendFileDisabled || appStore.backendService?.serverFeatureFlags === CARTA.ServerFeatureFlags.READ_ONLY || appStore.activeImage?.type !== ImageType.FRAME}
                        onClick={() => appStore.fileBrowserStore.showFileBrowser(BrowserMode.SaveFile, false)}
                    />
                </Tooltip>
                <MenuItem text="Close Image" label={`${modString}W`} disabled={appStore.isAppendFileDisabled || appStore.activeImage?.type === ImageType.PV_PREVIEW} onClick={() => appStore.closeCurrentFile(true)} />
                <MenuDivider />
                <Tooltip content={multiColorBlendingTooltip} position={Position.LEFT}>
                    <MenuItem text="Multi-Color Blending" disabled={appStore.frameNum < 1} onClick={appStore.imageViewConfigStore.createColorBlending} />
                </Tooltip>
                <Tooltip content={formTimeSeriesTooltip} position={Position.LEFT}>
                    <MenuItem text="Form Time Series" disabled={eligibleTimeSeriesFrameCount < 2 || hasTimeSeriesSlider} onClick={this.formTimeSeries} />
                </Tooltip>
                <MenuDivider />
                <MenuItem text="Import Regions" disabled={!appStore.activeFrame || appStore.activeFrame.isPreview} onClick={() => appStore.fileBrowserStore.showFileBrowser(BrowserMode.RegionImport, false)} />
                <Tooltip
                    content={"Not allowed in read-only mode"}
                    disabled={!appStore.activeFrame || !appStore.activeFrame.regionSet.regions || appStore.activeFrame.regionSet.regions.length <= 1 || appStore.backendService?.serverFeatureFlags !== CARTA.ServerFeatureFlags.READ_ONLY}
                    position={Position.LEFT}
                >
                    <MenuItem
                        text="Export Regions"
                        disabled={!appStore.activeFrame || !appStore.activeFrame.regionSet.regions || appStore.activeFrame.regionSet.regions.length <= 1 || appStore.backendService.serverFeatureFlags === CARTA.ServerFeatureFlags.READ_ONLY}
                        onClick={() => appStore.fileBrowserStore.showExportRegions()}
                    />
                </Tooltip>
                <MenuItem text="Import Catalog" label={`${modString}G`} disabled={appStore.isAppendFileDisabled || appStore.activeFrame?.isPreview} onClick={() => appStore.fileBrowserStore.showFileBrowser(BrowserMode.Catalog, false)} />
                <MenuItem text="Export Image" disabled={!appStore.activeFrame || appStore.isExportingImage || appStore.activeFrame.isPreview}>
                    <ExportImageMenuComponent />
                </MenuItem>
                <MenuDivider />
                <MenuItem text="Open Workspace" disabled={appStore.isOpenFileDisabled} onClick={() => appStore.dialogStore.showDialog(DialogId.Workspace, {mode: WorkspaceDialogMode.Open})} />
                <MenuItem text="Save Workspace" disabled={appStore.isOpenFileDisabled} onClick={() => appStore.dialogStore.showDialog(DialogId.Workspace, {mode: WorkspaceDialogMode.Save})} />
                <MenuDivider />
                <MenuItem text="Preferences" onClick={() => appStore.dialogStore.showDialog(DialogId.Preference)} />
                {serverSubMenu}
            </Menu>
        );

        const imageItems = Array.from(Array(appStore.imageViewConfigStore.imageNum).keys()).map(index => {
            const image = appStore.imageViewConfigStore.getImage(index);
            return <MenuItem text={image.store.filename} active={appStore.activeImageIndex === index} key={index} onClick={() => this.handleImageSelect(image)} />;
        });

        const viewMenu = (
            <Menu>
                <MenuItem text="Theme" icon={"media"}>
                    <MenuItem text="Automatic" icon={"contrast"} onClick={appStore.setAutoTheme} />
                    <MenuItem text="Light" icon={"flash"} onClick={appStore.setLightTheme} />
                    <MenuItem text="Dark" icon={"moon"} onClick={appStore.setDarkTheme} />
                </MenuItem>
                <MenuItem text="Layout" icon={"page-layout"} onClick={() => AppStore.Instance.dialogStore.showDialog(DialogId.Layout)} />
                {imageItems.length > 0 && (
                    <MenuItem text="Images" icon={"multi-select"}>
                        {imageItems}
                        <MenuDivider />
                        <MenuItem text="Previous Image" icon={"step-backward"} disabled={imageItems.length < 2} onClick={appStore.prevImage} />
                        <MenuItem text="Next Image" icon={"step-forward"} disabled={imageItems.length < 2} onClick={appStore.nextImage} />
                    </MenuItem>
                )}
                <MenuItem text="File Header" icon={"app-header"} disabled={!appStore.activeFrame} onClick={() => appStore.dialogStore.showDialog(DialogId.FileInfo)} />
                <MenuItem text="Contours" icon={<CustomIcon icon="contour" />} disabled={!appStore.activeFrame} onClick={() => appStore.dialogStore.showDialog(DialogId.Contour)} />
                <MenuItem text="Vector Overlay" icon={<CustomIcon icon="vectorOverlay" />} disabled={!appStore.activeFrame} onClick={() => appStore.dialogStore.showDialog(DialogId.Vector)} />
                <MenuItem text="Image Fitting" icon={<CustomIcon icon="imageFitting" />} disabled={!appStore.activeFrame} onClick={() => appStore.dialogStore.showDialog(DialogId.Fitting)} />
                <MenuItem text="Online Data Query" icon="geosearch" onClick={() => appStore.dialogStore.showDialog(DialogId.OnlineDataQuery)} />
                {appStore.preferenceStore.isCodeSnippetsEnabled && <MenuItem text="Code Snippets" icon={"console"} onClick={() => appStore.dialogStore.showDialog(DialogId.Snippet)} />}
            </Menu>
        );

        const helpMenu = (
            <Menu>
                <MenuItem text="Online Manual" icon={"manual"} onClick={() => this.handleDocumentationClicked(`https://carta.readthedocs.io/en/${CARTA_INFO.docsVersion}`)} />
                <MenuItem text="Controls and Shortcuts" icon={"key-control"} label={"Shift + ?"} onClick={() => appStore.dialogStore.showDialog(DialogId.Hotkey)} />
                <MenuItem text="About" icon={"info-sign"} onClick={() => appStore.dialogStore.showDialog(DialogId.About)} />
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
                if (appStore.backendService.hasConnectionDropped) {
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

        const isLoadingTiles = appStore.tileService.remainingTiles > 0;
        const isLoadingContours = appStore.activeFrame && appStore.activeFrame.contourProgress >= 0 && appStore.activeFrame.contourProgress < 1;
        const isLoadingVectorOverlay = appStore.activeFrame && appStore.activeFrame.vectorOverlayStore.progress >= 0 && appStore.activeFrame.vectorOverlayStore.progress < 1;
        let loadingTooltipFragment;
        const loadingIndicatorClass = "contour-loading-icon";
        let shouldShowLoadingIndicator = false;

        if (isLoadingTiles || isLoadingContours || isLoadingVectorOverlay) {
            let tilesTooltipContent;
            if (isLoadingTiles) {
                tilesTooltipContent = <span>Streaming image tiles. {appStore.tileService.remainingTiles} remaining</span>;
            }
            let contourTooltipContent;
            if (isLoadingContours && appStore.activeFrame) {
                contourTooltipContent = <span>Streaming contours. {toFixed(100 * appStore.activeFrame.contourProgress, 1)}% complete</span>;
            }

            let vectorOverlayTooltipContent;
            if (isLoadingVectorOverlay && appStore.activeFrame) {
                vectorOverlayTooltipContent = <span>Streaming vector overlay. {toFixed(100 * appStore.activeFrame.vectorOverlayStore.progress, 1)}% complete</span>;
            }

            loadingTooltipFragment = (
                <React.Fragment>
                    {tilesTooltipContent}
                    {isLoadingContours && isLoadingTiles && <br />}
                    {contourTooltipContent}
                    {vectorOverlayTooltipContent}
                </React.Fragment>
            );

            shouldShowLoadingIndicator = true;
        }

        let loadingIndicator;
        if (loadingTooltipFragment) {
            loadingIndicator = (
                <Tooltip content={loadingTooltipFragment}>
                    <Icon icon={"cloud-download"} className={loadingIndicatorClass} data-testid="progress-cloud" />
                </Tooltip>
            );
        } else {
            loadingIndicator = <Icon icon={"cloud-download"} className={loadingIndicatorClass} data-testid="progress-cloud" />;
        }

        const newReleaseMessage = (
            <div className={classNames(Classes.ALERT, "new-release", {[Classes.DARK]: appStore.isDarkTheme})}>
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
                    <Switch checked={this.isCheckReleaseDisabled} onChange={this.toggleDisableCheckRelease} label="Don't show new releases again" />
                </div>
            </div>
        );

        return (
            <div className="root-menu">
                <PopoverNext autoFocus={false} animation="minimal" arrow={false} shouldReturnFocusOnClose={false} content={fileMenu} placement="bottom-start">
                    <Menu className="root-menu-entry">
                        <MenuItem text="File" />
                    </Menu>
                </PopoverNext>
                <PopoverNext autoFocus={false} animation="minimal" arrow={false} shouldReturnFocusOnClose={false} content={viewMenu} placement="bottom-start">
                    <Menu className="root-menu-entry">
                        <MenuItem text="View" />
                    </Menu>
                </PopoverNext>
                <PopoverNext autoFocus={false} animation="minimal" arrow={false} shouldReturnFocusOnClose={false} content={this.genWidgetsMenu()} placement="bottom-start">
                    <Menu className="root-menu-entry">
                        <MenuItem text="Widgets" />
                    </Menu>
                </PopoverNext>
                {appStore.preferenceStore.isCodeSnippetsEnabled && this.snippetsMenu && (
                    <PopoverNext autoFocus={false} animation="minimal" arrow={false} shouldReturnFocusOnClose={false} content={this.snippetsMenu} placement="bottom-start">
                        <Menu className="root-menu-entry">
                            <MenuItem text="Snippets" />
                        </Menu>
                    </PopoverNext>
                )}
                <PopoverNext autoFocus={false} animation="minimal" arrow={false} shouldReturnFocusOnClose={false} content={helpMenu} placement="bottom-start">
                    <Menu className="root-menu-entry">
                        <MenuItem text="Help" />
                    </Menu>
                </PopoverNext>
                <ToolbarMenuComponent />
                <Alert
                    className={classNames({[Classes.DARK]: appStore.isDarkTheme})}
                    isOpen={this.isDocumentationAlertVisible}
                    onClose={this.handleAlertDismissed}
                    canEscapeKeyCancel={true}
                    canOutsideClickCancel={true}
                    confirmButtonText={"Dismiss"}
                >
                    Documentation will open in a new tab. Please ensure any popup blockers are disabled.
                </Alert>
                {appStore.shouldShowNewRelease && (
                    <PopoverNext content={newReleaseMessage} placement="bottom-end" shouldReturnFocusOnClose={false}>
                        <Tooltip content="New release available!" position={Position.BOTTOM_RIGHT}>
                            <Button icon={"envelope"} intent={"warning"} variant="minimal" />
                        </Tooltip>
                    </PopoverNext>
                )}
                {ApiService.runtimeConfig.apiAddress && appStore.activeWorkspace?.id && !appStore.layoutStore?.hasPopoutWidget && (
                    <Tooltip
                        content={
                            <span>
                                Share workspace (experimental)
                                <br />
                                <i>
                                    <small>Generate a URL to share workspace with other users</small>
                                </i>
                            </span>
                        }
                    >
                        <AnchorButton icon="share" variant="minimal" onClick={() => appStore.dialogStore.showDialog(DialogId.ShareWorkspace)} />
                    </Tooltip>
                )}
                {shouldShowLoadingIndicator && loadingIndicator}
                {appStore.preferenceStore.isLowBandwidthMode && (
                    <Tooltip
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
                    </Tooltip>
                )}
                {appStore.snippetStore.isExecuting && (
                    <Tooltip content="CARTA is currently executing a code snippet">
                        <Icon icon={"console"} intent={"warning"} />
                    </Tooltip>
                )}
                <Tooltip content={connectivityTooltip}>
                    <Icon icon={"symbol-circle"} className={connectivityClass} />
                </Tooltip>
                <div id="hidden-status-info">
                    <span id="info-session-id">{appStore.backendService.sessionId}</span>
                </div>
            </div>
        );
    }

    private handleDocumentationClicked = (url: string) => {
        window.open(url, "_blank", "width=1024");
        if (process.env.PUBLIC_REACT_APP_TARGET !== "linux" && process.env.PUBLIC_REACT_APP_TARGET !== "darwin") {
            this.isDocumentationAlertVisible = true;
            clearTimeout(this.documentationAlertTimeoutHandle);
            this.documentationAlertTimeoutHandle = undefined;
            this.documentationAlertTimeoutHandle = setTimeout(() => (this.isDocumentationAlertVisible = false), 10000);
        }
    };

    handleAlertDismissed = () => {
        this.isDocumentationAlertVisible = false;
    };

    handleImageSelect = (image: ImageViewItem) => {
        const appStore = AppStore.Instance;
        if (appStore.activeImage && appStore.activeImage === image) {
            return;
        } else {
            appStore.updateActiveImage(image);
        }
    };
}
