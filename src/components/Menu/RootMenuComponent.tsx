import * as React from "react";
import {observable} from "mobx";
import {observer} from "mobx-react";
import {Alert, Icon, Menu, Popover, Position, Tooltip, Tag} from "@blueprintjs/core";
import {ToolbarMenuComponent} from "./ToolbarMenu/ToolbarMenuComponent";
import {exportImage} from "components";
import {PresetLayout} from "models";
import {AppStore, BrowserMode} from "stores";
import {ConnectionStatus} from "services";
import {toFixed} from "utilities";
import "./RootMenuComponent.css";

@observer
export class RootMenuComponent extends React.Component<{ appStore: AppStore }> {
    @observable documentationAlertVisible: boolean;
    private documentationAlertTimeoutHandle;

    render() {
        const appStore = this.props.appStore;
        const modString = appStore.modifierString;
        const connectionStatus = appStore.backendService.connectionStatus;

        let stokesClassName = "stokes-item";
        if (this.props.appStore.darkTheme) {
            stokesClassName += " bp3-dark";
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
                    text="Export image"
                    label={`${modString}E`}
                    disabled={!appStore.activeFrame}
                    onClick={() => exportImage(appStore.overlayStore.padding, appStore.darkTheme, appStore.activeFrame.frameInfo.fileInfo.name)}
                />
                <Menu.Item text="Preferences" onClick={appStore.showPreferenceDialog}/>
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

        const viewMenu = (
            <Menu>
                <Menu.Item text="Interface" icon={"control"}>
                    <Menu.Item text="Light" icon={"flash"} onClick={appStore.setLightTheme}/>
                    <Menu.Item text="Dark" icon={"moon"} onClick={appStore.setDarkTheme}/>
                </Menu.Item>
                <Menu.Item text="Overlay" icon={"widget"}>
                    <Menu.Item text="Customize..." icon={"settings"} onClick={appStore.overlayStore.showOverlaySettings}/>
                </Menu.Item>
                {layerItems.length > 0 &&
                <Menu.Item text="Frames" icon={"layers"}>
                    {layerItems}
                    <Menu.Divider/>
                    <Menu.Item text="Previous frame" icon={"chevron-backward"} disabled={layerItems.length < 2} onClick={appStore.prevFrame}/>
                    <Menu.Item text="Next frame" icon={"chevron-forward"} disabled={layerItems.length < 2} onClick={appStore.nextFrame}/>
                </Menu.Item>
                }
            </Menu>
        );

        const presetLayouts: string[] = PresetLayout.PRESETS;
        const userLayouts: string[] = appStore.layoutStore.userLayouts;
        const stokesIcon = (
            <Tag icon={"pulse"} className={"stokes-icon-button"}>
                &nbsp;s
            </Tag>
        );
        const layoutMenu = (
            <Menu className="layout-menu">
                <Menu.Item text="Layouts" icon={"layout-grid"}>
                    <Menu.Item text="Existing Layouts" disabled={!presetLayouts && !userLayouts}>
                        <Menu.Item text="Presets" disabled={!presetLayouts || presetLayouts.length <= 0}>
                            {presetLayouts && presetLayouts.length > 0 && presetLayouts.map((value) =>
                                <Menu.Item
                                    key={value}
                                    text={value}
                                    active={value === appStore.layoutStore.currentLayoutName}
                                    onClick={() => appStore.layoutStore.applyLayout(value)}
                                />
                            )}
                        </Menu.Item>
                        {userLayouts && userLayouts.length > 0 && userLayouts.map((value) =>
                            <Menu.Item
                                key={value}
                                text={value}
                                active={value === appStore.layoutStore.currentLayoutName}
                                onClick={() => appStore.layoutStore.applyLayout(value)}
                            />
                        )}
                    </Menu.Item>
                    <Menu.Item text="Save Layout" onClick={appStore.showSaveLayoutDialog}/>
                    <Menu.Item text="Delete Layout" disabled={!userLayouts || userLayouts.length <= 0}>
                        {userLayouts && userLayouts.length > 0 && userLayouts.map((value) =>
                            <Menu.Item
                                key={value}
                                text={value}
                                active={value === appStore.layoutStore.currentLayoutName}
                                onClick={() => {
                                    appStore.layoutStore.deleteLayout(value);
                                    if (value === appStore.preferenceStore.layout) {
                                        appStore.preferenceStore.setLayout(PresetLayout.DEFAULT);
                                    }
                                }}
                            />
                        )}
                    </Menu.Item>
                </Menu.Item>
                <Menu.Item text="Info Panels" icon={"info-sign"}>
                    <Menu.Item text="Region List" onClick={appStore.widgetsStore.createFloatingRegionListWidget}/>
                    <Menu.Item text="Program Log" onClick={appStore.widgetsStore.createFloatingLogWidget}/>
                </Menu.Item>
                <Menu.Item text="Profiles" icon={"timeline-line-chart"}>
                    <Menu.Item text="Spatial Profiler" onClick={appStore.widgetsStore.createFloatingSpatialProfilerWidget}/>
                    <Menu.Item text="Spectral Profiler" onClick={appStore.widgetsStore.createFloatingSpectralProfilerWidget}/>
                </Menu.Item>
                <Menu.Item text="Statistics" icon={"calculator"} onClick={appStore.widgetsStore.createFloatingStatsWidget}/>
                <Menu.Item text="Histogram" icon={"timeline-bar-chart"} onClick={appStore.widgetsStore.createFloatingHistogramWidget}/>
                <Menu.Item text="Animator" icon={"video"} onClick={appStore.widgetsStore.createFloatingAnimatorWidget}/>
                <Menu.Item text="Render Config" icon={"style"} onClick={appStore.widgetsStore.createFloatingRenderWidget}/>
                <Menu.Item className={stokesClassName} text="Stokes Analysis" icon={stokesIcon} onClick={appStore.widgetsStore.createFloatingStokesWidget}/>
            </Menu>
        );

        const helpMenu = (
            <Menu>
                <Menu.Item text="Online Manual" icon={"help"} onClick={this.handleDocumentationClicked}/>
                <Menu.Item text="Controls and Shortcuts" label={"Shift + ?"} onClick={appStore.showHotkeyDialog}/>
                <Menu.Item text="About" icon={"info-sign"} onClick={appStore.showAboutDialog}/>
            </Menu>
        );

        let connectivityClass = "connectivity-icon";
        let tooltip = "";
        const latencyString = isFinite(appStore.backendService.endToEndPing) ? `${toFixed(appStore.backendService.endToEndPing, 1)} ms` : "Unknown";
        const userString = appStore.username ? ` as ${appStore.username}` : "";
        switch (connectionStatus) {
            case ConnectionStatus.PENDING:
                tooltip = `Connecting to server${userString}`;
                connectivityClass += " warning";
                break;
            case ConnectionStatus.ACTIVE:
                if (appStore.backendService.connectionDropped) {
                    tooltip = `Reconnected to server${userString} after disconnect. Some errors may occur. Latency: ${latencyString}`;
                    connectivityClass += " warning";
                } else {
                    tooltip = `Connected to server${userString}. Latency: ${latencyString}`;
                    connectivityClass += " online";
                }
                break;
            case ConnectionStatus.CLOSED:
            default:
                tooltip = `Disconnected from server. Latency: ${latencyString}`;
                connectivityClass += " offline";
                break;
        }
        connectivityClass += " online";

        let loadingIndicator: React.ReactNode;

        const tilesLoading = appStore.tileService.remainingTiles > 0;
        const contoursLoading = appStore.activeFrame && appStore.activeFrame.contourProgress >= 0 && appStore.activeFrame.contourProgress < 1;

        if (tilesLoading || contoursLoading) {
            let tilesTooltipContent;
            if (tilesLoading) {
                tilesTooltipContent = <span>Streaming image tiles. {appStore.tileService.remainingTiles} remaining</span>;
            }
            let contourTooltipContent;
            if (contoursLoading) {
                contourTooltipContent = <span>Streaming contours. {toFixed(100 * appStore.activeFrame.contourProgress, 1)}% complete</span>;
            }

            const tooltipFragment = (
                <React.Fragment>
                    {tilesTooltipContent}
                    {contoursLoading && tilesLoading && <br/>}
                    {contourTooltipContent}
                </React.Fragment>
            );

            loadingIndicator = (
                <Tooltip content={tooltipFragment}>
                    <Icon icon={"cloud-download"} className="contour-loading-icon"/>
                </Tooltip>
            );
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
                <Popover autoFocus={false} minimal={true} content={layoutMenu} position={Position.BOTTOM_LEFT}>
                    <Menu className="root-menu-entry">
                        <Menu.Item text="Layout"/>
                    </Menu>
                </Popover>
                <Popover autoFocus={false} minimal={true} content={helpMenu} position={Position.BOTTOM_LEFT}>
                    <Menu className="root-menu-entry">
                        <Menu.Item text="Help"/>
                    </Menu>
                </Popover>
                <ToolbarMenuComponent appStore={appStore}/>
                <Alert isOpen={this.documentationAlertVisible} onClose={this.handleAlertDismissed} canEscapeKeyCancel={true} canOutsideClickCancel={true} confirmButtonText={"Dismiss"}>
                    Documentation will open in a new tab. Please ensure any popup blockers are disabled.
                </Alert>
                {loadingIndicator}
                <Tooltip content={tooltip}>
                    <Icon icon={"symbol-circle"} className={connectivityClass}/>
                </Tooltip>
            </div>
        );
    }

    handleDocumentationClicked = () => {
        window.open("https://carta.readthedocs.io/en/latest", "_blank", "width=1024");
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
        const appStore = this.props.appStore;
        if (appStore.activeFrame && appStore.activeFrame.frameInfo.fileId === fileId) {
            return;
        } else {
            appStore.setActiveFrame(fileId);
        }
    };
}
