import * as React from "react";
import {AppState} from "../../../states/AppState";
import {observer} from "mobx-react";
import "./OverlaySettingsDialogComponent.css";
import {Button, Checkbox, Dialog, Intent, Tab, Tabs} from "@blueprintjs/core";

@observer
export class OverlaySettingsDialogComponent extends React.Component<{ appState: AppState }> {
    public render() {
        const appState = this.props.appState;
        const overlayState = appState.overlayState;
        const globalPanel = (
            <div>
                <div className="pt-form-group">
                    <div className="pt-form-content">
                        <Checkbox checked={overlayState.title.visible} indeterminate={overlayState.title.visible === undefined} label="Title" onChange={(ev) => overlayState.title.visible = ev.currentTarget.checked}/>
                        <label className="pt-label .pt-inline">
                            Title text
                            <input
                                className="pt-input"
                                type="text"
                                placeholder="Text input"
                                value={overlayState.title.text}
                                disabled={overlayState.title.visible === false}
                                onChange={(ev) => overlayState.title.text = ev.currentTarget.value}
                            />
                        </label>
                    </div>
                </div>
                <Checkbox checked={overlayState.grid.visible} indeterminate={overlayState.grid.visible === undefined} label="Grid" onChange={(ev) => overlayState.grid.visible = ev.currentTarget.checked}/>
                <Checkbox checked={overlayState.border.visible} indeterminate={overlayState.border.visible === undefined} label="Border" onChange={(ev) => overlayState.border.visible = ev.currentTarget.checked}/>
                <Checkbox checked={overlayState.axes.labelVisible || false} indeterminate={overlayState.axes.labelVisible === undefined} label="Axes Labels" onChange={(ev) => overlayState.axes.labelVisible = ev.currentTarget.checked}/>
                <Checkbox checked={overlayState.axes.numberVisible || false} indeterminate={overlayState.axes.numberVisible === undefined} label="Axes Numbers" onChange={(ev) => overlayState.axes.numberVisible = ev.currentTarget.checked}/>
            </div>
        );

        return (
            <Dialog icon={"settings"} lazy={true} backdropClassName="minimal-dialog-backdrop" isOpen={overlayState.overlaySettingsDialogVisible} onClose={overlayState.hideOverlaySettings} title="Overlay Settings">
                <div className="pt-dialog-body">
                    <Tabs id="overlayTabs" selectedTabId="global">
                        <Tab id="global" title="Global" panel={globalPanel}/>
                        <Tab id="axes" title="Axes (Common)"/>
                        <Tab id="axis1" title="Axis 1"/>
                        <Tab id="axis2" title="Axis 2"/>
                    </Tabs>
                </div>
                <div className="pt-dialog-footer">
                    <div className="pt-dialog-footer-actions">
                        <Button intent={Intent.PRIMARY} onClick={overlayState.hideOverlaySettings} text="Close"/>
                    </div>
                </div>
            </Dialog>
        );
    }
}