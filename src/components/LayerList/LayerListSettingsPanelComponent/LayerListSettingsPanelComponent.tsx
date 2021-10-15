import * as React from "react";
import {observer} from "mobx-react";
import {observable, action} from "mobx";
import {AppStore, WidgetProps, DefaultWidgetConfig, HelpType} from "stores";
import {SPECTRAL_MATCHING_TYPES, SPECTRAL_TYPE_STRING, SpectralType} from "models";
import {Tabs, Tab, TabId, FormGroup, HTMLSelect} from "@blueprintjs/core";
import "./LayerListSettingsPanelComponent.scss";

export enum LayerListSettingsTabs {
    MATCHING
}

@observer
export class LayerListSettingsPanelComponent extends React.Component<WidgetProps> {
    @observable selectedTabId: TabId = LayerListSettingsTabs.MATCHING;

    @action private setSelectedTab = (tab: TabId) => {
        this.selectedTabId = tab;
    };

    public static get WIDGET_CONFIG(): DefaultWidgetConfig {
        return {
            id: "layer-list-settings",
            type: "floating-settings",
            minWidth: 280,
            minHeight: 225,
            defaultWidth: 350,
            defaultHeight: 375,
            title: "layer-list-settings",
            isCloseable: true,
            parentId: "layer-list",
            parentType: "layer-list",
            helpType: HelpType.LAYER_LIST_SETTINGS
        };
    }

    render() {
        const appStore = AppStore.Instance;

        const matchingPanel = (
            <div className="panel-container">
                <FormGroup inline={true} label="Spectral Matching Type">
                    <HTMLSelect value={appStore.preferenceStore.spectralMatchingType} onChange={ev => appStore.setSpectralMatchingType(ev.currentTarget.value as SpectralType)}>
                        {SPECTRAL_MATCHING_TYPES.map(type => (
                            <option key={type} value={type}>
                                {SPECTRAL_TYPE_STRING.get(type)}
                            </option>
                        ))}
                    </HTMLSelect>
                </FormGroup>
            </div>
        );
        return (
            <div className="layer-list-settings-panel">
                <Tabs id="spatialSettingTabs" selectedTabId={this.selectedTabId} onChange={this.setSelectedTab}>
                    <Tab id={LayerListSettingsTabs.MATCHING} title="Matching" panel={matchingPanel} />
                </Tabs>
            </div>
        );
    }
}
