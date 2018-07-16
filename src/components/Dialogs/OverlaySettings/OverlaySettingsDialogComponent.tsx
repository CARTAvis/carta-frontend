import * as React from "react";
import {AppStore} from "../../../stores/AppStore";
import {observer} from "mobx-react";
import "./OverlaySettingsDialogComponent.css";
import {Button, Checkbox, Dialog, Intent, Tab, Tabs} from "@blueprintjs/core";

@observer
export class OverlaySettingsDialogComponent extends React.Component<{ appStore: AppStore }> {
    public render() {
        const appStore = this.props.appStore;
        const overlayStore = appStore.overlayStore;
        const globalPanel = (
            <div>
                <div className="bp3-form-group">
                    <div className="bp3-form-content">
                        <Checkbox checked={overlayStore.title.visible} indeterminate={overlayStore.title.visible === undefined} label="Title" onChange={(ev) => overlayStore.title.setVisible(ev.currentTarget.checked)}/>
                        <label className="bp3-label .bp3-inline">
                            Title text
                            <input
                                className="bp3-input"
                                type="text"
                                placeholder="Text input"
                                value={overlayStore.title.text}
                                disabled={overlayStore.title.visible === false}
                                onChange={(ev) => overlayStore.title.setText(ev.currentTarget.value)}
                            />
                        </label>
                    </div>
                </div>
                <Checkbox checked={overlayStore.grid.visible} indeterminate={overlayStore.grid.visible === undefined} label="Grid" onChange={(ev) => overlayStore.grid.setVisible(ev.currentTarget.checked)}/>
                <Checkbox checked={overlayStore.border.visible} indeterminate={overlayStore.border.visible === undefined} label="Border" onChange={(ev) => overlayStore.border.setVisible(ev.currentTarget.checked)}/>
                <Checkbox checked={overlayStore.axes.labelVisible || false} indeterminate={overlayStore.axes.labelVisible === undefined} label="Axes Labels" onChange={(ev) => overlayStore.axes.setLabelVisible(ev.currentTarget.checked)}/>
                <Checkbox
                    checked={overlayStore.axes.numberVisible || false}
                    indeterminate={overlayStore.axes.numberVisible === undefined}
                    label="Axes Numbers"
                    onChange={(ev) => overlayStore.axes.setNumberVisible(ev.currentTarget.checked)}
                />
            </div>
        );

        return (
            <Dialog icon={"settings"} lazy={true} backdropClassName="minimal-dialog-backdrop" isOpen={overlayStore.overlaySettingsDialogVisible} onClose={overlayStore.hideOverlaySettings} title="Overlay Settings">
                <div className="bp3-dialog-body">
                    <Tabs id="overlayTabs" selectedTabId="global">
                        <Tab id="global" title="Global" panel={globalPanel}/>
                        <Tab id="axes" title="Axes (Common)"/>
                        <Tab id="axis1" title="Axis 1"/>
                        <Tab id="axis2" title="Axis 2"/>
                    </Tabs>
                </div>
                <div className="bp3-dialog-footer">
                    <div className="bp3-dialog-footer-actions">
                        <Button intent={Intent.PRIMARY} onClick={overlayStore.hideOverlaySettings} text="Close"/>
                    </div>
                </div>
            </Dialog>
        );
    }
}