import * as React from "react";
import {observable} from "mobx";
import {observer} from "mobx-react";
import {Alert, Icon, Menu, Popover, Position, Tooltip} from "@blueprintjs/core";
import {ToolbarMenuComponent} from "./ToolbarMenu/ToolbarMenuComponent";
import {exportImage} from "components";
import {AppStore} from "stores";
import {ConnectionStatus} from "services";
import "./RootMenuComponent.css";

@observer
export class RootMenuComponent extends React.Component<{ appStore: AppStore }> {
    @observable documentationAlertVisible: boolean;
    private documentationAlertTimeoutHandle;

    render() {
        const appStore = this.props.appStore;
        const modString = appStore.modifierString;
        const connectionStatus = appStore.backendService.connectionStatus;

        const fileMenu = (
            <Menu>
                <Menu.Item
                    text="Open image"
                    label={`${modString}O`}
                    disabled={connectionStatus !== ConnectionStatus.ACTIVE || appStore.fileLoading}
                    onClick={() => appStore.fileBrowserStore.showFileBrowser(false)}
                />
                <Menu.Item
                    text="Append image"
                    label={`${modString}L`}
                    disabled={connectionStatus !== ConnectionStatus.ACTIVE || !appStore.activeFrame || appStore.fileLoading}
                    onClick={() => appStore.fileBrowserStore.showFileBrowser(true)}
                />
                <Menu.Divider/>
                <Menu.Item
                    text="Export image"
                    label={`${modString}E`}
                    disabled={!appStore.activeFrame}
                    onClick={() => exportImage(appStore.overlayStore.padding, appStore.darkTheme, appStore.activeFrame.frameInfo.fileInfo.name)}
                />
                <Menu.Divider/>
                <Menu.Item text="Enter API Key" onClick={appStore.showApiKeyDialog}/>
                <Menu.Item text="Connect to remote server" onClick={appStore.showURLConnect}/>
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

        const panelMenu = (
            <Menu>
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
        const latencyString = isFinite(appStore.backendService.endToEndPing) ? `${appStore.backendService.endToEndPing.toFixed(1)} ms` : "Unknown";
        switch (connectionStatus) {
            case ConnectionStatus.PENDING:
                tooltip = "Connecting to server";
                connectivityClass += " warning";
                break;
            case ConnectionStatus.ACTIVE:
                if (appStore.backendService.connectionDropped) {
                    tooltip = `Reconnected to server after disconnect. Some errors may occur. Latency: ${latencyString}`;
                    connectivityClass += " warning";
                } else {
                    tooltip = `Connected to server. Latency: ${latencyString}`;
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
                <Popover autoFocus={false} minimal={true} content={panelMenu} position={Position.BOTTOM_LEFT}>
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
                <span>DEBUG: Cache occupancy: {appStore.tileService.lruOccupancy} (LRU), {appStore.tileService.persistentOccupancy} (fixed)</span>
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
