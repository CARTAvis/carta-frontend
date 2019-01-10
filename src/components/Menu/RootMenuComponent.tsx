import * as React from "react";
import {observable} from "mobx";
import {observer} from "mobx-react";
import {Alert, Menu, Popover, Position} from "@blueprintjs/core";
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

        const fileMenu = (
            <Menu>
                <Menu.Item
                    text="Open image"
                    label={`${modString}O`}
                    disabled={appStore.backendService.connectionStatus !== ConnectionStatus.ACTIVE}
                    onClick={() => appStore.fileBrowserStore.showFileBrowser(false)}
                />
                <Menu.Item
                    text="Append image"
                    label={`${modString}L`}
                    disabled={appStore.backendService.connectionStatus !== ConnectionStatus.ACTIVE || !appStore.activeFrame}
                    onClick={() => appStore.fileBrowserStore.showFileBrowser(true)}
                />
                <Menu.Item text="Load region" disabled={true}/>
                <Menu.Divider/>
                <Menu.Item
                    text="Export image"
                    icon={"floppy-disk"}
                    label={`${modString}E`}
                    disabled={appStore.backendService.connectionStatus !== ConnectionStatus.ACTIVE || !appStore.activeFrame}
                    onClick={() => exportImage(appStore.overlayStore.padding, appStore.darkTheme, appStore.activeFrame.frameInfo.fileInfo.name)}
                />
                <Menu.Divider/>
                <Menu.Item text="Preferences" icon={"cog"} label={`${modString}P`} disabled={true}/>
                <Menu.Item text="Connect to URL" onClick={appStore.showURLConnect}/>
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
                    <Menu.Item text="DS9 Preset" disabled={true}/>
                    <Menu.Item text="CASA Preset" disabled={true}/>
                    <Menu.Divider/>
                    <Menu.Item text="Custom Preset 1" disabled={true}/>
                    <Menu.Item text="Custom Preset 2" disabled={true}/>
                    <Menu.Divider/>
                    <Menu.Item text="Customize..." icon={"settings"} onClick={appStore.overlayStore.showOverlaySettings}/>
                    <Menu.Item text="Save Current as Preset" icon={"floppy-disk"} disabled={true}/>
                </Menu.Item>
                <Menu.Item text="Graphs" icon={"timeline-line-chart"} disabled={true}>
                    <Menu.Item text="DS9 Preset"/>
                    <Menu.Item text="CASA Preset"/>
                    <Menu.Divider/>
                    <Menu.Item text="My graph preset"/>
                    <Menu.Item text="Another graph preset"/>
                    <Menu.Divider/>
                    <Menu.Item text="Customize..." icon={"style"}/>
                    <Menu.Item text="Save Current as Preset" icon={"floppy-disk"}/>
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
                <Menu.Item text="Profiles" icon={"timeline-line-chart"}>
                    <Menu.Item text="Spatial Profiler" onClick={appStore.widgetsStore.createFloatingSpatialProfilerWidget}/>
                    <Menu.Item text="Spectral Profiler" onClick={appStore.widgetsStore.createFloatingSpectralProfilerWidget}/>
                </Menu.Item>
                <Menu.Item text="Histograms" icon={"timeline-bar-chart"} disabled={true}>
                    <Menu.Item text="Region Histogram"/>
                    <Menu.Item text="Slice Histogram"/>
                </Menu.Item>
                <Menu.Item text="Info Panels" icon={"info-sign"}>
                    <Menu.Item text="Region Statistics" disabled={true}/>
                    <Menu.Item text="Program Log" onClick={appStore.widgetsStore.createFloatingLogWidget}/>
                </Menu.Item>
                <Menu.Divider/>
                <Menu.Item text="3D Height-map" icon={"mountain"} disabled={true}/>
                <Menu.Item text="Animator" icon={"video"} onClick={appStore.widgetsStore.createFloatingAnimatorWidget}/>
                <Menu.Item text="Render Config" icon={"style"} onClick={appStore.widgetsStore.createFloatingRenderWidget}/>
                <Menu.Divider/>
                <Menu.Item text="Presets" icon={"new-grid-item"} disabled={true}>
                    <Menu.Item text="Image Only"/>
                    <Menu.Item text="3D with Profiles"/>
                    <Menu.Item text="Full Stokes"/>
                    <Menu.Divider/>
                    <Menu.Item text="Custom Preset 1" label={`${modString}1`}/>
                    <Menu.Item text="Custom Preset 2" label={`${modString}2`}/>
                    <Menu.Divider/>
                    <Menu.Item text="Save Current as Preset" icon={"floppy-disk"}/>
                </Menu.Item>
            </Menu>
        );

        const helpMenu = (
            <Menu>
                <Menu.Item text="Online Manual" icon={"help"} label={"F1"} onClick={this.handleDocumentationClicked}/>
                <Menu.Item text="Controls and Shortcuts" label={"Shift + ?"} onClick={appStore.showHotkeyDialog}/>
                <Menu.Item text="About" icon={"info-sign"} onClick={appStore.showAboutDialog}/>
            </Menu>
        );

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
            </div>
        );
    }

    handleDocumentationClicked = () => {
        window.open("https://cartavis.github.io/manual", "_blank", "width=1024");
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
