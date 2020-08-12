import * as React from "react";
import {observable} from "mobx";
import {observer} from "mobx-react";
import {Alert, Icon, Menu, Popover, Position, Tooltip, Tag, MenuDivider} from "@blueprintjs/core";
import {ToolbarMenuComponent} from "./ToolbarMenu/ToolbarMenuComponent";
import {PresetLayout} from "models";
import {AppStore, BrowserMode, PreferenceKeys} from "stores";
import {ApiService, ConnectionStatus} from "services";
import {toFixed} from "utilities";
import {CustomIcon} from "icons/CustomIcons";
import "./RootMenuComponent.css";

@observer
export class RootMenuComponent extends React.Component {
    @observable documentationAlertVisible: boolean;
    private documentationAlertTimeoutHandle;

    private handleDashboardClicked = () => {
        window.open(ApiService.RuntimeConfig.dashboardAddress, "_blank");
    };

    render() {
        const appStore = AppStore.Instance;
        const modString = appStore.modifierString;
        const connectionStatus = appStore.backendService.connectionStatus;

        let stokesClassName = "stokes-item";
        if (appStore.darkTheme) {
            stokesClassName += " bp3-dark";
        }

        let serverMenu: React.ReactNode[] = [];

        const apiService = appStore.apiService;
        if (apiService.authenticated && ApiService.RuntimeConfig.apiAddress) {
            serverMenu.push(
                <Menu.Item
                    key="restart"
                    text="Restart Service"
                    disabled={!appStore.apiService.authenticated}
                    onClick={appStore.apiService.stopServer}
                />
            );
        }
        if (ApiService.RuntimeConfig.logoutAddress || ApiService.RuntimeConfig.googleClientId) {
            serverMenu.push(
                <Menu.Item
                    key="logout"
                    text="Logout"
                    disabled={!appStore.apiService.authenticated}
                    onClick={appStore.apiService.logout}
                />
            );
        }
        if (ApiService.RuntimeConfig.dashboardAddress) {
            serverMenu.push(
                <Menu.Item
                    key="dashboard"
                    text="Dashboard"
                    onClick={this.handleDashboardClicked}
                />
            );
        }

        let serverSubMenu: React.ReactNode;
        if (serverMenu.length) {
            serverSubMenu = (
                <React.Fragment>
                    <Menu.Divider/>
                    <Menu.Item text="Server">
                        {serverMenu}
                    </Menu.Item>
                </React.Fragment>
            );
        }

        const fileMenu = (
            <Menu>
                <Menu.Item
                    text="Open image"
                    label={`${modString}O`}
                    disabled={connectionStatus !== ConnectionStatus.ACTIVE || appStore.fileLoading}
                    onClick={() => appStore.fileBrowserStore.showFileBrowser(BrowserMode.File, false)}
                />
                <Menu.Item
                    text="Append image"
                    label={`${modString}L`}
                    disabled={connectionStatus !== ConnectionStatus.ACTIVE || !appStore.activeFrame || appStore.fileLoading}
                    onClick={() => appStore.fileBrowserStore.showFileBrowser(BrowserMode.File, true)}
                />
                <Menu.Item
                    text="Save image"
                    label={`${modString}S`}
                    disabled={connectionStatus !== ConnectionStatus.ACTIVE || !appStore.activeFrame || appStore.fileLoading}
                    onClick={() => appStore.fileBrowserStore.showFileBrowser(BrowserMode.SaveFile, false)}
                />
                <Menu.Item
                    text="Close image"
                    label={`${modString}W`}
                    disabled={connectionStatus !== ConnectionStatus.ACTIVE || !appStore.activeFrame || appStore.fileLoading}
                    onClick={() => appStore.closeCurrentFile(true)}
                />
                <Menu.Divider/>
                <Menu.Item
                    text="Import regions"
                    disabled={!appStore.activeFrame}
                    onClick={() => appStore.fileBrowserStore.showFileBrowser(BrowserMode.RegionImport, false)}
                />
                <Menu.Item
                    text="Export regions"
                    disabled={!appStore.activeFrame || !appStore.activeFrame.regionSet.regions || appStore.activeFrame.regionSet.regions.length <= 1}
                    onClick={() => appStore.fileBrowserStore.showFileBrowser(BrowserMode.RegionExport, false)}
                />
                <Menu.Divider/>
                <Menu.Item
                    text="Import catalog"
                    label={`${modString}C`}
                    disabled={connectionStatus !== ConnectionStatus.ACTIVE || !appStore.activeFrame || appStore.fileLoading}
                    onClick={() => appStore.fileBrowserStore.showFileBrowser(BrowserMode.Catalog, false)}
                />
                <Menu.Divider/>
                <Menu.Item
                    text="Export image"
                    label={`${modString}E`}
                    disabled={!appStore.activeFrame}
                    onClick={appStore.exportImage}
                />
                <Menu.Item text="Preferences" onClick={appStore.dialogStore.showPreferenceDialog} disabled={appStore.preferenceStore.supportsServer && connectionStatus !== ConnectionStatus.ACTIVE}/>
                {serverSubMenu}
            </Menu>
        );

        let layerItems = appStore.frames.slice().sort((a, b) => a.frameInfo.fileId <= b.frameInfo.fileId ? -1 : 1).map(frame => {
            return (
                <Menu.Item
                    text={frame.frameInfo.fileInfo.name}
                    active={appStore.activeFrame && appStore.activeFrame.frameInfo.fileId === frame.frameInfo.fileId}
                    key={frame.frameInfo.fileId}
                    onClick={() => this.handleFrameSelect(frame.frameInfo.fileId)}
                />
            );
        });

        const presetLayouts: string[] = PresetLayout.PRESETS;
        const layoutStore = appStore.layoutStore;
        const userLayouts: string[] = layoutStore.userLayoutNames;

        const viewMenu = (
            <Menu>
                <Menu.Item text="Theme" icon={"media"}>
                    <Menu.Item text="Automatic" icon={"contrast"} onClick={appStore.setAutoTheme}/>
                    <Menu.Item text="Light" icon={"flash"} onClick={appStore.setLightTheme}/>
                    <Menu.Item text="Dark" icon={"moon"} onClick={appStore.setDarkTheme}/>
                </Menu.Item>
                <Menu.Item text="Layouts" icon={"page-layout"} disabled={layoutStore.supportsServer && connectionStatus !== ConnectionStatus.ACTIVE}>
                    <Menu.Item text="Existing Layouts" disabled={!presetLayouts && !userLayouts}>
                        {presetLayouts && presetLayouts.length > 0 && presetLayouts.map((value) =>
                            <Menu.Item
                                key={value}
                                text={value}
                                active={value === appStore.layoutStore.currentLayoutName}
                                onClick={() => appStore.layoutStore.applyLayout(value)}
                            />
                        )}
                        {userLayouts && userLayouts.length > 0 && (
                            <React.Fragment>
                                <MenuDivider/>
                                {userLayouts.map((value) =>
                                    <Menu.Item
                                        key={value}
                                        text={value}
                                        active={value === appStore.layoutStore.currentLayoutName}
                                        onClick={() => appStore.layoutStore.applyLayout(value)}
                                    />
                                )}
                            </React.Fragment>
                        )}
                    </Menu.Item>
                    <Menu.Item text="Save Layout" onClick={appStore.dialogStore.showSaveLayoutDialog}/>
                    <Menu.Item text="Delete Layout" disabled={!userLayouts || userLayouts.length <= 0}>
                        {userLayouts && userLayouts.length > 0 && userLayouts.map((value) =>
                            <Menu.Item
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
                        )}
                    </Menu.Item>
                </Menu.Item>
                {layerItems.length > 0 &&
                <Menu.Item text="Images" icon={"multi-select"}>
                    {layerItems}
                    <Menu.Divider/>
                    <Menu.Item text="Previous image" icon={"step-backward"} disabled={layerItems.length < 2} onClick={appStore.prevFrame}/>
                    <Menu.Item text="Next image" icon={"step-forward"} disabled={layerItems.length < 2} onClick={appStore.nextFrame}/>
                </Menu.Item>
                }
                <Menu.Item
                    text="File header"
                    icon={"app-header"}
                    disabled={!appStore.activeFrame}
                    onClick={appStore.dialogStore.showFileInfoDialog}
                />
                <Menu.Item
                    text="Contours"
                    icon={<CustomIcon icon="contour"/>}
                    onClick={appStore.dialogStore.showContourDialog}
                />
            </Menu>
        );

        const widgetsMenu = (
            <Menu className="widgets-menu">
                <Menu.Item text="Info Panels" icon={"panel-stats"}>
                    <Menu.Item text="Region List" icon={<CustomIcon icon="regionList"/>} onClick={appStore.widgetsStore.createFloatingRegionListWidget}/>
                    <Menu.Item text="Image List" icon={"layers"} onClick={appStore.widgetsStore.createFloatingLayerListWidget}/>
                    <Menu.Item text="Program Log" icon={"application"} onClick={appStore.widgetsStore.createFloatingLogWidget}/>
                </Menu.Item>
                <Menu.Item text="Profiles" icon={"pulse"}>
                    <Menu.Item text="Spatial Profiler" icon={<CustomIcon icon="spatialProfiler"/>} onClick={appStore.widgetsStore.createFloatingSpatialProfilerWidget}/>
                    <Menu.Item text="Spectral Profiler" icon={<CustomIcon icon="spectralProfiler"/>} onClick={appStore.widgetsStore.createFloatingSpectralProfilerWidget}/>
                </Menu.Item>
                <Menu.Item text="Statistics" icon={"calculator"} onClick={appStore.widgetsStore.createFloatingStatsWidget}/>
                <Menu.Item text="Histogram" icon={"timeline-bar-chart"} onClick={appStore.widgetsStore.createFloatingHistogramWidget}/>
                <Menu.Item text="Animator" icon={"video"} onClick={appStore.widgetsStore.createFloatingAnimatorWidget}/>
                <Menu.Item text="Render Config" icon={"style"} onClick={appStore.widgetsStore.createFloatingRenderWidget}/>
                <Menu.Item text="Stokes Analysis" icon={<CustomIcon icon="stokes"/>} onClick={appStore.widgetsStore.createFloatingStokesWidget}/>
                <Menu.Item text="Catalog" icon={"heatmap"} onClick={appStore.widgetsStore.reloadFloatingCatalogWidget}/>
                <Menu.Item text="Spectral Line Query" icon={<CustomIcon icon={"spectralLineQuery"}/>} onClick={appStore.widgetsStore.createFloatingSpectralLineQueryWidget}/>
            </Menu>
        );

        const helpMenu = (
            <Menu>
                <Menu.Item text="Online Manual" icon={"manual"} onClick={this.handleDocumentationClicked}/>
                <Menu.Item text="Controls and Shortcuts" icon={"key-control"} label={"Shift + ?"} onClick={appStore.dialogStore.showHotkeyDialog}/>
                <Menu.Item text="Debug Execution" icon={"console"} onClick={appStore.dialogStore.showDebugExecutionDialog}/>
                <Menu.Item text="About" icon={"info-sign"} onClick={appStore.dialogStore.showAboutDialog}/>
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
                    connectivityTooltip = <span>Reconnected to server {userString} after disconnect. Some errors may occur<br/><i><small>Latency: {latencyString}</small></i></span>;
                    connectivityClass += " warning";
                } else {
                    connectivityTooltip = <span>Connected to server {userString}<br/><i><small>Latency: {latencyString}<br/>Session ID: {appStore.backendService.sessionId}</small></i></span>;
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
        const contoursLoading = appStore.activeFrame && appStore.activeFrame.contourProgress >= 0 && appStore.activeFrame.contourProgress < 1;
        let loadingTooltipFragment;
        let loadingIndicatorClass = "contour-loading-icon";

        if (tilesLoading || contoursLoading) {
            let tilesTooltipContent;
            if (tilesLoading) {
                tilesTooltipContent = <span>Streaming image tiles. {appStore.tileService.remainingTiles} remaining</span>;
            }
            let contourTooltipContent;
            if (contoursLoading) {
                contourTooltipContent = <span>Streaming contours. {toFixed(100 * appStore.activeFrame.contourProgress, 1)}% complete</span>;
            }

            loadingTooltipFragment = (
                <React.Fragment>
                    {tilesTooltipContent}
                    {contoursLoading && tilesLoading && <br/>}
                    {contourTooltipContent}
                </React.Fragment>
            );

            loadingIndicatorClass += " icon-visible";
        }

        let loadingIndicator;
        if (loadingTooltipFragment) {
            loadingIndicator = (
                <Tooltip content={loadingTooltipFragment}>
                    <Icon icon={"cloud-download"} className={loadingIndicatorClass}/>
                </Tooltip>
            );
        } else {
            loadingIndicator = <Icon icon={"cloud-download"} className={loadingIndicatorClass}/>;
        }

        return (
            <div className="root-menu">
                <Popover autoFocus={false} minimal={true} content={fileMenu} position={Position.BOTTOM_LEFT}>
                    <Menu className="root-menu-entry">
                        <Menu.Item text="File"/>
                    </Menu>
                </Popover>
                <Popover autoFocus={false} minimal={true} content={viewMenu} position={Position.BOTTOM_LEFT}>
                    <Menu className="root-menu-entry">
                        <Menu.Item text="View"/>
                    </Menu>
                </Popover>
                <Popover autoFocus={false} minimal={true} content={widgetsMenu} position={Position.BOTTOM_LEFT}>
                    <Menu className="root-menu-entry">
                        <Menu.Item text="Widgets"/>
                    </Menu>
                </Popover>
                <Popover autoFocus={false} minimal={true} content={helpMenu} position={Position.BOTTOM_LEFT}>
                    <Menu className="root-menu-entry">
                        <Menu.Item text="Help"/>
                    </Menu>
                </Popover>
                <ToolbarMenuComponent/>
                <Alert isOpen={this.documentationAlertVisible} onClose={this.handleAlertDismissed} canEscapeKeyCancel={true} canOutsideClickCancel={true} confirmButtonText={"Dismiss"}>
                    Documentation will open in a new tab. Please ensure any popup blockers are disabled.
                </Alert>
                {loadingIndicator}
                {appStore.preferenceStore.lowBandwidthMode &&
                <Tooltip content={<span>CARTA is running in low bandwidth mode<br/><i><small>Image resolution and cursor responsiveness will be reduced</small></i></span>}>
                    <Icon icon={"feed"} className="connectivity-icon warning"/>
                </Tooltip>
                }
                <Tooltip content={connectivityTooltip}>
                    <Icon icon={"symbol-circle"} className={connectivityClass}/>
                </Tooltip>
            </div>
        );
    }

    handleDocumentationClicked = () => {
        window.open("https://carta.readthedocs.io/en/1.4", "_blank", "width=1024");
        if (process.env.REACT_APP_TARGET !== "linux" && process.env.REACT_APP_TARGET !== "darwin") {
            this.documentationAlertVisible = true;
            clearTimeout(this.documentationAlertTimeoutHandle);
            this.documentationAlertTimeoutHandle = setTimeout(() => this.documentationAlertVisible = false, 10000);
        }
    };

    handleAlertDismissed = () => {
        this.documentationAlertVisible = false;
    };

    handleFrameSelect = (fileId: number) => {
        const appStore = AppStore.Instance;
        if (appStore.activeFrame && appStore.activeFrame.frameInfo.fileId === fileId) {
            return;
        } else {
            appStore.setActiveFrame(fileId);
        }
    };
}
