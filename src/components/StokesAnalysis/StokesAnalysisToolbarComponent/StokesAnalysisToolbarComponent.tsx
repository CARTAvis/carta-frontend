import {observer} from "mobx-react";
import {CARTA} from "carta-protobuf";
import * as React from "react";
import {AnchorButton, FormGroup, Switch, ButtonGroup, Tooltip} from "@blueprintjs/core";
import {AppStore, FrameStore} from "stores";
import {StokesAnalysisWidgetStore} from "stores/widgets";
import {StokesAnalysisComponent, RegionSelectorComponent, StokesAnalysisSettingsTabs} from "components";
import {CustomIcon} from "icons/CustomIcons";
import "./StokesAnalysisToolbarComponent.scss";

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
        const appStore = AppStore.Instance;
        let enableFractionalPol = false;

        if (appStore?.activeFrame?.stokesFiles?.length) {
            appStore.activeFrame.stokesFiles.forEach(file => {
                if (file.stokesType === CARTA.StokesType.I) {
                    enableFractionalPol = true;
                }
            });
        } else{ 
            if (widgetStore.effectiveFrame?.regionSet) {
                enableFractionalPol = widgetStore.effectiveFrame.frameInfo.fileInfoExtended.stokes > 1;
            }
        }

        return (
            <div className="stokes-analysis-toolbar">
                <RegionSelectorComponent widgetStore={this.props.widgetStore} onFrameChanged={this.handleFrameChanged}/>
                <FormGroup label={"Frac. Pol."} inline={true} disabled={!enableFractionalPol}>
                    <Switch checked={widgetStore.fractionalPolVisible} onChange={this.handleFractionalPolChanged} disabled={!enableFractionalPol}/>
                </FormGroup>
                <ButtonGroup className="profile-buttons">
                    <Tooltip content="Smoothing">
                        <AnchorButton icon={<CustomIcon icon="smoothing"/>} onClick={this.smoothingShortcutClick}/>
                    </Tooltip>
                </ButtonGroup>
            </div>
        );
    }
}