import {observer} from "mobx-react";
import * as React from "react";
import {AnchorButton, ButtonGroup, Tooltip} from "@blueprintjs/core";
import {AppStore} from "stores";
import {SpectralProfileWidgetStore} from "stores/widgets";
import {SpectralProfilerComponent, SpectralProfilerSettingsTabs} from "components";
import {ProfileSelectionComponent} from "./ProfileSelectionComponent";
import {CustomIcon} from "icons/CustomIcons";
import "./SpectralProfilerToolbarComponent.scss";

@observer
export class SpectralProfilerToolbarComponent extends React.Component<{ widgetStore: SpectralProfileWidgetStore, id: string }> {
    private smoothingShortcutClick = () => {
        this.props.widgetStore.setSettingsTabId(SpectralProfilerSettingsTabs.SMOOTHING);
        AppStore.Instance.widgetsStore.createFloatingSettingsWidget(SpectralProfilerComponent.WIDGET_CONFIG.title, this.props.id, SpectralProfilerComponent.WIDGET_CONFIG.type);
    };

    private momentsShortcutClick = () => {
        this.props.widgetStore.setSettingsTabId(SpectralProfilerSettingsTabs.MOMENTS);
        AppStore.Instance.widgetsStore.createFloatingSettingsWidget(SpectralProfilerComponent.WIDGET_CONFIG.title, this.props.id, SpectralProfilerComponent.WIDGET_CONFIG.type);
    };

    public render() {
        const widgetStore = this.props.widgetStore;
        return (
            <div className="spectral-profiler-toolbar">
                <ProfileSelectionComponent widgetStore={widgetStore}/>
                <ButtonGroup className="profile-buttons">
                    <Tooltip content="Smoothing">
                        <AnchorButton icon={<CustomIcon icon="smoothing"/>} onClick={this.smoothingShortcutClick}/>
                    </Tooltip>
                    <Tooltip content="Moments">
                        <AnchorButton icon={<CustomIcon icon="moments"/>} onClick={this.momentsShortcutClick}/>
                    </Tooltip>
                </ButtonGroup>
            </div>
        );
    }
}
