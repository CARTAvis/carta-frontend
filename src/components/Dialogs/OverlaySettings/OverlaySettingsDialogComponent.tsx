import * as React from "react";
import {AppState} from "../../../Models/AppState";
import {observer} from "mobx-react";
import {Button, Checkbox, Dialog, Intent, Tab, Tabs} from "@blueprintjs/core";

@observer
export class OverlaySettingsDialogComponent extends React.Component<{ appState: AppState }> {
    public render() {
        const appState = this.props.appState;
        const settings = appState.overlaySettings;
        const globalPanel = (
            <div>
                <div className="pt-form-group">
                    <div className="pt-form-content">
                    <Checkbox checked={settings.title.visible} indeterminate={settings.title.visible === undefined} label="Title" onChange={(ev) => settings.title.visible = ev.currentTarget.checked}/>
                    <label className="pt-label .pt-inline">
                        Title text
                        <input className="pt-input" type="text" placeholder="Text input" value={settings.title.text} disabled={settings.title.visible === false} onChange={(ev) => settings.title.text = ev.currentTarget.value}/>
                    </label>
                    </div>
                </div>
                <Checkbox checked={settings.grid.visible} indeterminate={settings.grid.visible === undefined} label="Grid" onChange={(ev) => settings.grid.visible = ev.currentTarget.checked}/>
                <Checkbox checked={settings.border.visible} indeterminate={settings.border.visible === undefined} label="Border" onChange={(ev) => settings.border.visible = ev.currentTarget.checked}/>
                <Checkbox checked={settings.axes.labelVisible || false} indeterminate={settings.axes.labelVisible === undefined} label="Axes Labels" onChange={(ev) => settings.axes.labelVisible = ev.currentTarget.checked}/>
                <Checkbox checked={settings.axes.numberVisible || false} indeterminate={settings.axes.numberVisible === undefined} label="Axes Numbers" onChange={(ev) => settings.axes.numberVisible = ev.currentTarget.checked}/>

            </div>
        );

        return (
            <Dialog icon={"settings"} isOpen={appState.overlaySettingsDialogVisible} onClose={appState.hideOverlaySettings} title="Overlay Settings">
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
                        <Button intent={Intent.PRIMARY} onClick={appState.hideOverlaySettings} text="Close"/>
                    </div>
                </div>
            </Dialog>
        );
    }
}