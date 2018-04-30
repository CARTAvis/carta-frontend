import * as React from "react";
import "./RootMenuComponent.css";
import {Menu, MenuDivider, MenuItem, Popover, Position} from "@blueprintjs/core";
import {AppState} from "../../Models/AppState";
import {observer} from "mobx-react";

@observer
export class RootMenuComponent extends React.Component<{ appState: AppState }> {

    render() {
        const appState = this.props.appState;

        // Modifier string for shortcut keys. OSX/iOS use '⌘', while Windows uses 'Ctrl + '
        // const modString = "Ctrl + ";
        const modString = "⌘";

        const fileMenu = (
            <Menu>
                <MenuItem text="Load cube" label={`${modString}O`}/>
                <MenuItem text="Load region"/>
                <MenuDivider/>
                <MenuItem text="Export annotations" icon={"floppy-disk"}/>
                <MenuItem text="Export image" icon={"media"} label={`${modString}E`}/>
                <MenuDivider/>
                <MenuItem text="Preferences" icon={"cog"} label={`${modString}P`}/>
                <MenuDivider/>
                <MenuItem text="Exit" icon={"log-out"} label={`${modString}Q`}/>
            </Menu>
        );

        const viewMenu = (
            <Menu>
                <MenuItem text="Interface" icon={"control"}>
                    <MenuItem text="Light" icon={"flash"}/>
                    <MenuItem text="Dark" icon={"moon"}/>
                </MenuItem>
                <MenuItem text="Overlay" icon={"widget"}>
                    <MenuItem text="DS9 Preset"/>
                    <MenuItem text="CASA Preset"/>
                    <MenuDivider/>
                    <MenuItem text="Custom Preset 1"/>
                    <MenuItem text="Custom Preset 2"/>
                    <MenuDivider/>
                    <MenuItem text="Customize..." icon={"style"} onClick={appState.showOverlaySettings}/>
                    <MenuItem text="Save Current as Preset" icon={"floppy-disk"}/>
                </MenuItem>
                <MenuItem text="Graphs" icon={"timeline-line-chart"}>
                    <MenuItem text="DS9 Preset"/>
                    <MenuItem text="CASA Preset"/>
                    <MenuDivider/>
                    <MenuItem text="My graph preset"/>
                    <MenuItem text="Another graph preset"/>
                    <MenuDivider/>
                    <MenuItem text="Customize..." icon={"style"}/>
                    <MenuItem text="Save Current as Preset" icon={"floppy-disk"}/>
                </MenuItem>

                <MenuItem text="Fullscreen" icon={"fullscreen"} label={"F11"}/>
            </Menu>
        );

        const panelMenu = (
            <Menu>
                <MenuItem text="Profiles" icon={"timeline-line-chart"}>
                    <MenuItem text="X-Profile"/>
                    <MenuItem text="Y-Profile"/>
                    <MenuItem text="Z-Profile"/>
                </MenuItem>
                <MenuItem text="Histograms" icon={"timeline-bar-chart"}>
                    <MenuItem text="Region Histogram"/>
                    <MenuItem text="Slice Histogram"/>
                </MenuItem>
                <MenuItem text="Info Panels" icon={"info-sign"}>
                    <MenuItem text="Region Statistics"/>
                    <MenuItem text="Cursor Info"/>
                    <MenuItem text="Program Log"/>
                    <MenuItem text="Debug Info"/>
                </MenuItem>
                <MenuDivider/>
                <MenuItem text="3D Height-map" icon={"mountain"}/>
                <MenuItem text="Animator" icon={"video"}/>
                <MenuItem text="Color map" icon={"contrast"}/>
                <MenuDivider/>
                <MenuItem text="Presets" icon={"new-grid-item"}>
                    <MenuItem text="Image Only"/>
                    <MenuItem text="3D with Profiles"/>
                    <MenuItem text="Full Stokes"/>
                    <MenuDivider/>
                    <MenuItem text="Custom Preset 1" label={`${modString}1`}/>
                    <MenuItem text="Custom Preset 2" label={`${modString}2`}/>
                    <MenuDivider/>
                    <MenuItem text="Save Current as Preset" icon={"floppy-disk"}/>
                </MenuItem>
            </Menu>
        );

        const helpMenu = (
            <Menu>
                <MenuItem text="Getting Started" icon={"help"} label={"F1"}/>
                <MenuItem text="Controls and Shortcuts" icon={"info-sign"}/>
                <MenuItem text="Search help" icon={"search"} label={"Shift + Space"}/>
                <MenuItem text="About" icon={"info-sign"}/>
            </Menu>
        );

        return (
            <div className="Root-menu">
                <Popover minimal={true} content={fileMenu} position={Position.BOTTOM_LEFT}>
                    <Menu className="Root-menu-entry">
                        <MenuItem text="File"/>
                    </Menu>
                </Popover>
                <Popover minimal={true} content={viewMenu} position={Position.BOTTOM_LEFT}>
                    <Menu className="Root-menu-entry">
                        <MenuItem text="View"/>
                    </Menu>
                </Popover>
                <Popover minimal={true} content={panelMenu} position={Position.BOTTOM_LEFT}>
                    <Menu className="Root-menu-entry">
                        <MenuItem text="Layout"/>
                    </Menu>
                </Popover>
                <Popover minimal={true} content={helpMenu} position={Position.BOTTOM_LEFT}>
                    <Menu className="Root-menu-entry">
                        <MenuItem text="Help"/>
                    </Menu>
                </Popover>
            </div>
        );
    }
}