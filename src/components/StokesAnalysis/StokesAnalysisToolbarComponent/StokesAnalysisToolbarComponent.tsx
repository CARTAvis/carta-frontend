import * as React from "react";
import {AnchorButton, ButtonGroup, FormGroup, Switch} from "@blueprintjs/core";
import {Tooltip2} from "@blueprintjs/popover2";
import {CARTA} from "carta-protobuf";
import {observer} from "mobx-react";

import {StokesAnalysisComponent, StokesAnalysisSettingsTabs} from "components";
import {RegionSelectorComponent} from "components/Shared";
import {CustomIcon} from "icons/CustomIcons";
import {AppStore} from "stores";
import {FrameStore} from "stores/Frame";
import {StokesAnalysisWidgetStore} from "stores/widgets";

import "./StokesAnalysisToolbarComponent.scss";

@observer
export class StokesAnalysisToolbarComponent extends React.Component<{widgetStore: StokesAnalysisWidgetStore; id: string}> {
    private handleFractionalPolChanged = (changeEvent: React.ChangeEvent<HTMLInputElement>) => {
        this.props.widgetStore.setFractionalPolVisible(changeEvent.target.checked);
    };

    private smoothingShortcutClick = () => {
        this.props.widgetStore.setSettingsTabId(StokesAnalysisSettingsTabs.SMOOTHING);
        AppStore.Instance.widgetsStore.createFloatingSettingsWidget(StokesAnalysisComponent.WIDGET_CONFIG.title, this.props.id, StokesAnalysisComponent.WIDGET_CONFIG.type);
    };

    private handleFrameChanged = (newFrame: FrameStore) => {
        if (newFrame && newFrame.regionSet && !(newFrame.frameInfo.fileInfoExtended.stokes > 1)) {
            this.props.widgetStore.setFractionalPolVisible(false);
        }
    };

    public render() {
        const widgetStore = this.props.widgetStore;
        const appStore = AppStore.Instance;
        let enableFractionalPol = false;

        if (appStore?.activeFrame?.stokesFiles?.length) {
            appStore.activeFrame.stokesFiles.forEach(file => {
                if (file.polarizationType === CARTA.PolarizationType.I) {
                    enableFractionalPol = true;
                }
            });
        } else {
            if (widgetStore.effectiveFrame?.regionSet) {
                enableFractionalPol = widgetStore.effectiveFrame.frameInfo.fileInfoExtended.stokes > 1;
            }
        }

        return (
            <div className="stokes-analysis-toolbar">
                <RegionSelectorComponent widgetStore={this.props.widgetStore} onFrameChanged={this.handleFrameChanged} />
                <FormGroup label={"Frac. Pol."} inline={true} disabled={!enableFractionalPol}>
                    <Switch checked={widgetStore.fractionalPolVisible} onChange={this.handleFractionalPolChanged} disabled={!enableFractionalPol} />
                </FormGroup>
                <ButtonGroup className="profile-buttons">
                    <Tooltip2 content="Smoothing">
                        <AnchorButton icon={<CustomIcon icon="smoothing" />} onClick={this.smoothingShortcutClick} />
                    </Tooltip2>
                </ButtonGroup>
            </div>
        );
    }
}
