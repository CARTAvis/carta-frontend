import * as React from "react";
import classNames from "classnames";
import {observer} from "mobx-react";
import {observable, action, makeObservable} from "mobx";
import {AppStore, WidgetProps, DefaultWidgetConfig, HelpType} from "stores";
import {SPECTRAL_MATCHING_TYPES, SPECTRAL_TYPE_STRING, SpectralType, FrequencyUnit} from "models";
import {FormGroup, HTMLSelect, MenuDivider, Tab, TabId, Tabs, Text} from "@blueprintjs/core";
import {ClearableNumericInputComponent} from "components/Shared";
import "./LayerListSettingsPanelComponent.scss";

export enum LayerListSettingsTabs {
    MATCHING,
    REST_FREQ
}

const FILENAME_END_LEN = 15

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
            minWidth: 360,
            minHeight: 225,
            defaultWidth: 400,
            defaultHeight: 375,
            title: "layer-list-settings",
            isCloseable: true,
            parentId: "layer-list",
            parentType: "layer-list",
            helpType: HelpType.LAYER_LIST_SETTINGS
        };
    }

    constructor(props: WidgetProps) {
        super(props);
        makeObservable(this);
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

        const restFreqPanel = (
            <div className="panel-container">
                {appStore.frames.map((frame, index) => {
                    const isActive = index === appStore.activeFrameIndex;
                    const style = classNames({"disabled": !frame.isRestFreqEditable}, {"dark": appStore.darkTheme}, {"active": isActive});
                    const filenameEndLen = FILENAME_END_LEN - (isActive ? 9 : 0);
                    return (
                        <React.Fragment key={index}>
                            <FormGroup inline={true} label="Source" className="name-text" disabled={!frame.isRestFreqEditable}>
                                <Text className={style} ellipsize={true}>
                                    {`${index}: `}{frame.filename.slice(0, -1 - filenameEndLen)}
                                </Text>
                                <Text className={style}>
                                    {frame.filename.slice(-1 - filenameEndLen, -1)}
                                </Text>
                                {isActive ?
                                    <Text className={style}>
                                        {"\u00a0(Active)"}
                                    </Text>
                                : null}
                            </FormGroup>
                            <div className="freq-input">
                                <ClearableNumericInputComponent
                                    label="Rest frequency"
                                    value={0}
                                    disabled={!frame.isRestFreqEditable}
                                    placeholder="rest frequency"
                                    selectAllOnFocus={true}
                                    onValueChanged={() => {}}
                                    onValueCleared={() => {}}
                                    resetDisabled={false}
                                    tooltipContent={"default"}
                                    tooltipPlacement={"bottom"}
                                />
                                <HTMLSelect disabled={!frame.isRestFreqEditable} options={Object.values(FrequencyUnit)} value={"Hz"} onChange={ev => console.log(ev.currentTarget.value as FrequencyUnit)} />
                            </div>
                            {index !== appStore.frames.length - 1 ? <MenuDivider/> : null}
                        </React.Fragment>
                )})}
            </div>
        );

        return (
            <div className="layer-list-settings-panel">
                <Tabs id="layerListSettingsTabs" selectedTabId={this.selectedTabId} onChange={this.setSelectedTab}>
                    <Tab id={LayerListSettingsTabs.MATCHING} title="Matching" panel={matchingPanel} />
                    <Tab id={LayerListSettingsTabs.REST_FREQ} title="Rest Frequency" panel={restFreqPanel} />
                </Tabs>
            </div>
        );
    }
}
