import {observer} from "mobx-react";
import * as React from "react";
import {FormGroup, Switch, ButtonGroup, Button, Tooltip} from "@blueprintjs/core";
import {AppStore, FrameStore} from "stores";
import {StokesAnalysisWidgetStore, StokesAnalysisSettingsTabs} from "stores/widgets";
import {StokesAnalysisComponent, RegionSelectorComponent} from "components";
import {CustomIcon} from "icons/CustomIcons";
import "./StokesAnalysisToolbarComponent.css";

@observer
export class StokesAnalysisToolbarComponent extends React.Component<{widgetStore: StokesAnalysisWidgetStore, id: string}> {

    private handleFractionalPolChanged = (changeEvent: React.ChangeEvent<HTMLInputElement>) => {
        this.props.widgetStore.setFractionalPolVisible(changeEvent.target.checked);
    };

    private smoothingShortcutClick = () => {
        this.props.widgetStore.setSettingsTabId(StokesAnalysisSettingsTabs.SMOOTHING);
        AppStore.Instance.widgetsStore.createFloatingSettingsWidget(StokesAnalysisComponent.WIDGET_CONFIG.title, this.props.id, StokesAnalysisComponent.WIDGET_CONFIG.type);
    }

    private handleFrameChanged = (newFrame: FrameStore) => {
        if (newFrame && newFrame.regionSet && !(newFrame.frameInfo.fileInfoExtended.stokes > 1)) {
            this.props.widgetStore.setFractionalPolVisible(false);
        }
    };

    public render() {
        const widgetStore = this.props.widgetStore;
        const frame = AppStore.Instance.activeFrame;

        let enableFractionalPol = false;
        if (widgetStore.effectiveFrame && widgetStore.effectiveFrame.regionSet) {
            enableFractionalPol = widgetStore.effectiveFrame.frameInfo.fileInfoExtended.stokes > 1;
        }

        return (
            <div className="stokes-analysis-toolbar">
                <RegionSelectorComponent widgetStore={this.props.widgetStore} onFrameChanged={this.handleFrameChanged}/>
                <FormGroup label={"Frac. Pol."} inline={true} disabled={!enableFractionalPol}>
                    <Switch checked={widgetStore.fractionalPolVisible} onChange={this.handleFractionalPolChanged} disabled={!enableFractionalPol}/>
                </FormGroup>
                <ButtonGroup className="profile-buttons">
                    <Tooltip content="Smoothing">
                        <Button icon={<CustomIcon icon="smoothing"/>} onClick={this.smoothingShortcutClick}/>
                    </Tooltip>
                </ButtonGroup>
            </div>
        );
    }
}