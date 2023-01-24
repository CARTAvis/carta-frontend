import * as React from "react";
import {Alignment, Button, FormGroup, HTMLSelect, MenuDivider, MenuItem, PopoverPosition, Tab, Tabs, Text} from "@blueprintjs/core";
import {IItemRendererProps, Select} from "@blueprintjs/select";
import classNames from "classnames";
import {computed, makeObservable} from "mobx";
import {observer} from "mobx-react";

import {ClearableNumericInputComponent} from "components/Shared";
import {FrequencyUnit, SPECTRAL_MATCHING_TYPES, SPECTRAL_TYPE_STRING, SpectralType} from "models";
import {AppStore, DefaultWidgetConfig, HelpType, WidgetProps, WidgetsStore} from "stores";
import {LayerListSettingsTabs, LayerListWidgetStore} from "stores/widgets";

import "./LayerListSettingsPanelComponent.scss";

const FILENAME_END_LEN = 15;

@observer
export class LayerListSettingsPanelComponent extends React.Component<WidgetProps> {
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

    @computed get widgetStore(): LayerListWidgetStore {
        const widgetsStore = WidgetsStore.Instance;
        if (widgetsStore.layerListWidgets) {
            const widgetStore = widgetsStore.layerListWidgets.get(this.props.id);
            if (widgetStore) {
                return widgetStore;
            }
        }
        console.log("can't find store for widget");
        return null;
    }

    constructor(props) {
        super(props);
        makeObservable(this);
    }

    private renderFrameOptions = (val: number, itemProps: IItemRendererProps) => {
        const option = this.widgetStore.restFreqFrameOptions.find(option => option.frameIndex === val);
        return <MenuItem key={option?.frameIndex} text={option?.label} disabled={option?.disable} onClick={itemProps.handleClick} active={itemProps.modifiers.active} />;
    };

    private renderRestFreqInput = frameOption => {
        const restFreqStore = AppStore.Instance.frames[frameOption.frameIndex]?.restFreqStore;
        return (
            <div className="freq-input">
                <ClearableNumericInputComponent
                    label="Rest frequency"
                    value={restFreqStore.customRestFreq.value}
                    disabled={frameOption.disable}
                    placeholder="rest frequency"
                    selectAllOnFocus={true}
                    onValueChanged={val => {
                        restFreqStore.setCustomVal(val);
                        if (AppStore.Instance.frameNum <= 10) {
                            this.widgetStore.resetSelectedFrameIndex();
                        }
                    }}
                    onValueCleared={restFreqStore.restoreDefaults}
                    resetDisabled={restFreqStore.resetDisable}
                    tooltipContent={restFreqStore.defaultInfo}
                    tooltipPlacement={"bottom"}
                    focused={frameOption.frameIndex === this.widgetStore.selectedFrameIndex}
                />
                <HTMLSelect disabled={frameOption.disable} options={Object.values(FrequencyUnit)} value={restFreqStore.customRestFreq.unit} onChange={ev => restFreqStore.setCustomUnit(ev.currentTarget.value as FrequencyUnit)} />
            </div>
        );
    };

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

        const selectedFrameIndex = this.widgetStore.selectedFrameIndex;
        const frameOptions = this.widgetStore.restFreqFrameOptions;
        let restFreqPanel = null;
        if (appStore.frameNum > 10) {
            const fileText = frameOptions.find(option => option.frameIndex === selectedFrameIndex)?.label;
            const inputFrame = frameOptions.find(option => option.frameIndex === (selectedFrameIndex === -1 ? appStore.activeFrameIndex : selectedFrameIndex));
            restFreqPanel = (
                <div className="panel-container">
                    <FormGroup inline={true} label="Source" className="name-text">
                        <Select
                            filterable={false}
                            items={this.widgetStore.restFreqFrameOptions.map(option => option.frameIndex)}
                            activeItem={selectedFrameIndex}
                            onItemSelect={this.widgetStore.setSelectedFrameIndex}
                            itemRenderer={this.renderFrameOptions}
                            popoverProps={{minimal: true, position: PopoverPosition.AUTO_END}}
                        >
                            <Button text={fileText} rightIcon="double-caret-vertical" alignText={Alignment.LEFT} />
                        </Select>
                    </FormGroup>
                    {this.renderRestFreqInput(inputFrame)}
                </div>
            );
        } else {
            restFreqPanel = (
                <div className="panel-container">
                    {frameOptions.slice(1).map((option, index) => {
                        const style = classNames({disabled: option.disable}, {dark: appStore.darkTheme}, {active: option.active});
                        return (
                            <React.Fragment key={index}>
                                <FormGroup inline={true} label="Source" className="name-text" disabled={option.disable}>
                                    <Text className={style} ellipsize={true} title={option.label}>
                                        {option.label.slice(0, -FILENAME_END_LEN)}
                                    </Text>
                                    <Text className={classNames(style, "end-part")} title={option.label}>
                                        {option.label.slice(-FILENAME_END_LEN)}
                                    </Text>
                                </FormGroup>
                                {this.renderRestFreqInput(option)}
                                {index !== appStore.frames.length - 1 ? <MenuDivider /> : null}
                            </React.Fragment>
                        );
                    })}
                </div>
            );
        }

        return (
            <div className="layer-list-settings-panel">
                <Tabs id="layerListSettingsTabs" selectedTabId={this.widgetStore.settingsTabId} onChange={this.widgetStore.setSettingsTabId}>
                    <Tab id={LayerListSettingsTabs.MATCHING} title="Matching" panel={matchingPanel} />
                    <Tab id={LayerListSettingsTabs.REST_FREQ} title="Rest Frequency" panel={restFreqPanel} />
                </Tabs>
            </div>
        );
    }
}
