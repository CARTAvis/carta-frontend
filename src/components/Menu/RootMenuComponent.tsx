import * as React from "react";
import "./RootMenuComponent.css";
import {Menu, Popover, Position} from "@blueprintjs/core";
import {AppStore} from "../../stores/AppStore";
import {observer} from "mobx-react";
import {ConnectionStatus} from "../../services/BackendService";

@observer
export class RootMenuComponent extends React.Component<{ appStore: AppStore }> {

    render() {
        const appStore = this.props.appStore;

        // Modifier string for shortcut keys. OSX/iOS use '⌘', while Windows uses 'Ctrl + '
        const modString = "alt + ";
        // const modString = "⌘";

        const fileMenu = (
            <Menu>
                <Menu.Item
                    text="Open cube"
                    label={`${modString}O`}
                    disabled={appStore.backendService.connectionStatus !== ConnectionStatus.ACTIVE}
                    onClick={() => appStore.fileBrowserStore.showFileBrowser(false)}
                />
                <Menu.Item
                    text="Open cube as new frame"
                    label={`${modString}A`}
                    disabled={appStore.backendService.connectionStatus !== ConnectionStatus.ACTIVE || !appStore.activeFrame}
                    onClick={() => appStore.fileBrowserStore.showFileBrowser(true)}
                />
                <Menu.Item text="Load region"/>
                <Menu.Divider/>
                <Menu.Item text="Export annotations" icon={"floppy-disk"}/>
                <Menu.Item text="Export image" icon={"media"} label={`${modString}E`}/>
                <Menu.Divider/>
                <Menu.Item text="Preferences" icon={"cog"} label={`${modString}P`}/>
                <Menu.Item text="Connect to URL" onClick={appStore.showURLConnect}/>
                <Menu.Divider/>
                <Menu.Item text="Exit" icon={"log-out"} label={`${modString}Q`}/>
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
                    <Menu.Item text="Light" icon={"flash"}/>
                    <Menu.Item text="Dark" icon={"moon"}/>
                </Menu.Item>
                <Menu.Item text="Overlay" icon={"widget"}>
                    <Menu.Item text="DS9 Preset"/>
                    <Menu.Item text="CASA Preset"/>
                    <Menu.Divider/>
                    <Menu.Item text="Custom Preset 1"/>
                    <Menu.Item text="Custom Preset 2"/>
                    <Menu.Divider/>
                    <Menu.Item text="Customize..." icon={"style"} onClick={appStore.overlayStore.showOverlaySettings}/>
                    <Menu.Item text="Save Current as Preset" icon={"floppy-disk"}/>
                </Menu.Item>
                <Menu.Item text="Graphs" icon={"timeline-line-chart"}>
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
                <Menu.Item text="Fullscreen" icon={"fullscreen"} label={"F11"}/>
            </Menu>
        );

        const panelMenu = (
            <Menu>
                <Menu.Item text="Undo layout change" icon={"undo"} disabled={!appStore.layoutSettings.hasLayoutHistory} onClick={appStore.layoutSettings.undoLayoutChange}/>
                <Menu.Item text="Profiles" icon={"timeline-line-chart"}>
                    <Menu.Item text="X-Profile"/>
                    <Menu.Item text="Y-Profile"/>
                    <Menu.Item text="Z-Profile"/>
                </Menu.Item>
                <Menu.Item text="Histograms" icon={"timeline-bar-chart"}>
                    <Menu.Item text="Region Histogram"/>
                    <Menu.Item text="Slice Histogram"/>
                </Menu.Item>
                <Menu.Item text="Info Panels" icon={"info-sign"}>
                    <Menu.Item text="Region Statistics"/>
                    <Menu.Item text="Cursor Info"/>
                    <Menu.Item text="Program Log"/>
                    <Menu.Item text="Debug Info"/>
                </Menu.Item>
                <Menu.Divider/>
                <Menu.Item text="3D Height-map" icon={"mountain"}/>
                <Menu.Item text="Animator" icon={"video"}/>
                <Menu.Item text="Color map" icon={"contrast"}/>
                <Menu.Divider/>
                <Menu.Item text="Presets" icon={"new-grid-item"}>
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
                <Menu.Item text="Getting Started" icon={"help"} label={"F1"}/>
                <Menu.Item text="Controls and Shortcuts" icon={"info-sign"}/>
                <Menu.Item text="Search help" icon={"search"} label={"Shift + Space"}/>
                <Menu.Item text="About" icon={"info-sign"}/>
            </Menu>
        );

        return (
            <div className="Root-menu">
                <Popover minimal={true} content={fileMenu} position={Position.BOTTOM_LEFT}>
                    <Menu className="Root-menu-entry">
                        <Menu.Item text="File"/>
                    </Menu>
                </Popover>
                <Popover minimal={true} content={viewMenu} position={Position.BOTTOM_LEFT}>
                    <Menu className="Root-menu-entry">
                        <Menu.Item text="View"/>
                    </Menu>
                </Popover>
                <Popover minimal={true} content={panelMenu} position={Position.BOTTOM_LEFT}>
                    <Menu className="Root-menu-entry">
                        <Menu.Item text="Layout"/>
                    </Menu>
                </Popover>
                <Popover minimal={true} content={helpMenu} position={Position.BOTTOM_LEFT}>
                    <Menu className="Root-menu-entry">
                        <Menu.Item text="Help"/>
                    </Menu>
                </Popover>
            </div>
        );
    }

    handleFrameSelect = (fileId: number) => {
        const appStore = this.props.appStore;
        if (appStore.activeFrame && appStore.activeFrame.frameInfo.fileId === fileId) {
            return;
        }
        else {
            appStore.setActiveFrame(fileId);
        }
    };
}