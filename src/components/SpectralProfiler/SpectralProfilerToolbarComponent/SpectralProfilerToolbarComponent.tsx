import * as React from "react";
import {AnchorButton, ButtonGroup, Checkbox, Classes, Intent, Menu, MenuItem, Popover, Position, Tooltip} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import classNames from "classnames";
import {observer} from "mobx-react";
import type {LineOption} from "models";

import {SpectralProfilerComponent} from "components";
import {MultiProfileCategory, SpectralProfilerSettingsTabs} from "enums";
import {CustomIcon} from "icons/CustomIcons";
import {AppStore} from "stores";
import {type SpectralProfileSelectionStore, type SpectralProfileWidgetStore} from "stores/Widgets";

import "./SpectralProfilerToolbarComponent.scss";

type MultiSelectItem = string | CARTA.StatsType;

class ProfileSelectionButtonComponentProps {
    categoryName: MultiProfileCategory;
    isActiveCategory: boolean;
    itemOptions: LineOption[];
    itemSelected: MultiSelectItem[];
    isDisabled: boolean;
    isOptionsDisabled?: boolean;
    isSelectingSpecificItem?: boolean;
    categoryTooltip: JSX.Element;
    dropdownTooltip: {nonActive: string; active: string; disabled: string};
    onCategorySelect: () => void;
    onItemSelect: (item: MultiSelectItem, itemIndex: number) => void;
}

@observer
class ProfileSelectionButtonComponent extends React.Component<ProfileSelectionButtonComponentProps> {
    public render() {
        const itemOptions = this.props.itemOptions;
        const itemSelected = this.props.itemSelected;
        let dropdownText = "";
        if (itemOptions && itemSelected?.length > 0) {
            itemSelected.forEach((selectedItemValue, index) => {
                const selectedItemOption = itemOptions.find(item => item.value === selectedItemValue);
                if (selectedItemOption?.label) {
                    dropdownText += `${selectedItemOption.label}${index !== itemSelected.length - 1 ? "," : ""}`;
                }
            });
        }

        let dropdownHelpText = "";
        if (!this.props.isDisabled && this.props.dropdownTooltip) {
            if (this.props.isOptionsDisabled) {
                dropdownHelpText = this.props.dropdownTooltip.disabled ?? "Selection is disabled.";
            } else if (this.props.isActiveCategory) {
                dropdownHelpText = this.props.dropdownTooltip.active ?? "Click to select multiple items.";
            } else {
                dropdownHelpText = this.props.dropdownTooltip.nonActive ?? "Click to select an item.";
            }
        }

        const className = classNames("category-set", {[Classes.DARK]: AppStore.Instance.isDarkTheme});

        return (
            <div className={className}>
                <Tooltip content={this.props.categoryTooltip} position={Position.TOP}>
                    <Checkbox className={"category-checkbox"} label={this.props.categoryName} checked={this.props.isActiveCategory} onChange={ev => this.props.onCategorySelect()} disabled={this.props.isDisabled} />
                </Tooltip>
                <Popover
                    content={
                        <Menu className="spectral-profiler-dropdown">
                            {this.props.itemOptions?.map((item, index) => (
                                <MenuItem
                                    key={item.value}
                                    text={item.active ? <b>{item.label}</b> : item.label}
                                    disabled={item?.disabled}
                                    intent={item.hightlight ? Intent.PRIMARY : Intent.NONE}
                                    onClick={ev => this.props.onItemSelect(item.value, index)}
                                    icon={this.props.itemSelected?.includes(item.value) ? "tick" : "blank"}
                                    shouldDismissPopover={true}
                                    data-testid={"spectral-profiler-" + this.props.categoryName.toLowerCase() + "-dropdown-" + (item.label || "").split(" ").join("-").toLowerCase()}
                                />
                            ))}
                        </Menu>
                    }
                    minimal={true}
                    placement={Position.BOTTOM}
                    disabled={this.props.isDisabled || this.props.isOptionsDisabled}
                >
                    <Tooltip disabled={!dropdownHelpText} content={dropdownHelpText} position={Position.TOP}>
                        <AnchorButton
                            text={
                                <span className="overflow-text" title={dropdownText}>
                                    {this.props.isSelectingSpecificItem ? <b>{dropdownText}</b> : dropdownText}
                                </span>
                            }
                            className="dropdown-button"
                            rightIcon={"caret-down"}
                            disabled={this.props.isDisabled || this.props.isOptionsDisabled}
                            data-testid={"spectral-profiler-" + this.props.categoryName.toLowerCase() + "-dropdown"}
                        />
                    </Tooltip>
                </Popover>
            </div>
        );
    }
}

@observer
class ProfileSelectionComponent extends React.Component<{profileSelectionStore: SpectralProfileSelectionStore}> {
    private selectProfileItem = <T,>(category: MultiProfileCategory, selectedItem: T, selectSingleMode: (item: T) => void, selectMultiMode: (item: T) => void) => {
        const profileSelectionStore = this.props.profileSelectionStore;
        if (profileSelectionStore.activeProfileCategory !== category) {
            selectSingleMode(selectedItem);
            return;
        }

        selectMultiMode(selectedItem);
    };

    // Frame selection does not allow multiple selection
    private onFrameItemClick = (selectedFrame: number, _itemIndex: number) => {
        const profileSelectionStore = this.props.profileSelectionStore;
        this.selectProfileItem(
            MultiProfileCategory.IMAGE,
            selectedFrame,
            value => profileSelectionStore.selectFrame(value),
            value => profileSelectionStore.selectFrameMultiMode(value)
        );
    };

    private onRegionItemClick = (selectedRegion: number, _itemIndex: number) => {
        const profileSelectionStore = this.props.profileSelectionStore;
        this.selectProfileItem(
            MultiProfileCategory.REGION,
            selectedRegion,
            value => profileSelectionStore.selectRegionSingleMode(value),
            value => profileSelectionStore.selectRegionMultiMode(value)
        );
    };

    private onStatsItemClick = (selectedStatsType: CARTA.StatsType, _itemIndex: number) => {
        const profileSelectionStore = this.props.profileSelectionStore;
        this.selectProfileItem(
            MultiProfileCategory.STATISTIC,
            selectedStatsType,
            value => profileSelectionStore.selectStatSingleMode(value),
            value => profileSelectionStore.selectStatMultiMode(value)
        );
    };

    private onStokesItemClick = (selectedStokes: string, _itemIndex: number) => {
        const profileSelectionStore = this.props.profileSelectionStore;
        this.selectProfileItem(
            MultiProfileCategory.STOKES,
            selectedStokes,
            value => profileSelectionStore.selectCoordinateSingleMode(value),
            value => profileSelectionStore.selectCoordinateMultiMode(value)
        );
    };

    public render() {
        const profileSelectionStore = this.props.profileSelectionStore;
        const frame = profileSelectionStore.selectedFrame;
        const isDisabled = !frame?.channelInfo;

        return (
            <div className="profile-selection-panel">
                <ProfileSelectionButtonComponent
                    categoryName={MultiProfileCategory.IMAGE}
                    isActiveCategory={profileSelectionStore.activeProfileCategory === MultiProfileCategory.IMAGE}
                    itemOptions={profileSelectionStore.frameOptions}
                    itemSelected={profileSelectionStore.activeProfileCategory === MultiProfileCategory.IMAGE ? profileSelectionStore.selectedFileIds : [profileSelectionStore.selectedFrameWidgetFileId]}
                    isDisabled={!frame}
                    isSelectingSpecificItem={profileSelectionStore.isSelectingActiveFrame}
                    onCategorySelect={() => {
                        profileSelectionStore.setActiveProfileCategory(profileSelectionStore.activeProfileCategory !== MultiProfileCategory.IMAGE ? MultiProfileCategory.IMAGE : MultiProfileCategory.NONE);
                    }}
                    onItemSelect={this.onFrameItemClick}
                    categoryTooltip={
                        <span>
                            {`Click to enable/disable multiple profiles of ${MultiProfileCategory.IMAGE}`}
                            <span>
                                <br />
                                <i>
                                    <small>
                                        When enabled, Spectral Profiler will show multiple profiles from
                                        <br />
                                        different images which are matched both spatially and spectrally.
                                        <br />
                                        Toggle both spatial(XY) and spectral(Z) matching in Image List widget.
                                    </small>
                                </i>
                            </span>
                        </span>
                    }
                    dropdownTooltip={{
                        nonActive: "Click to select an image.",
                        active: "Click to select an image. Images matched by toggling both spatial(XY) and spectral(Z) matching via Image List widget are highlighted.",
                        disabled: ""
                    }}
                />
                <ProfileSelectionButtonComponent
                    categoryName={MultiProfileCategory.REGION}
                    isActiveCategory={profileSelectionStore.activeProfileCategory === MultiProfileCategory.REGION}
                    itemOptions={profileSelectionStore.regionOptions}
                    itemSelected={profileSelectionStore.selectedRegionIds}
                    isDisabled={isDisabled}
                    isSelectingSpecificItem={profileSelectionStore.isSelectingActiveRegion}
                    onCategorySelect={() => {
                        profileSelectionStore.setActiveProfileCategory(profileSelectionStore.activeProfileCategory !== MultiProfileCategory.REGION ? MultiProfileCategory.REGION : MultiProfileCategory.NONE);
                    }}
                    onItemSelect={this.onRegionItemClick}
                    categoryTooltip={
                        <span>
                            {`Click to enable/disable multiple selections of ${MultiProfileCategory.REGION}`}
                            <span>
                                <br />
                                <i>
                                    <small>When enabled, Spectral Profiler will show multiple profiles from different selected regions.</small>
                                </i>
                            </span>
                        </span>
                    }
                    dropdownTooltip={{
                        nonActive: "Click to select a region.",
                        active: "Click to select multiple regions.",
                        disabled: ""
                    }}
                />
                <ProfileSelectionButtonComponent
                    categoryName={MultiProfileCategory.STATISTIC}
                    isActiveCategory={profileSelectionStore.activeProfileCategory === MultiProfileCategory.STATISTIC}
                    itemOptions={profileSelectionStore.statsTypeOptions}
                    itemSelected={profileSelectionStore.isStatsTypeSelectionAvailable ? profileSelectionStore.selectedStatsTypes : [CARTA.StatsType.Mean]}
                    isDisabled={isDisabled}
                    isOptionsDisabled={!profileSelectionStore.isStatsTypeSelectionAvailable}
                    onCategorySelect={() => {
                        profileSelectionStore.setActiveProfileCategory(profileSelectionStore.activeProfileCategory !== MultiProfileCategory.STATISTIC ? MultiProfileCategory.STATISTIC : MultiProfileCategory.NONE);
                    }}
                    onItemSelect={this.onStatsItemClick}
                    categoryTooltip={
                        <span>
                            {`Click to enable/disable multiple selections of ${MultiProfileCategory.STATISTIC}`}
                            <span>
                                <br />
                                <i>
                                    <small>When enabled, Spectral Profiler will show multiple profiles with different selected statistic quantities.</small>
                                </i>
                            </span>
                        </span>
                    }
                    dropdownTooltip={{
                        nonActive: "Click to select a statistic quantity.",
                        active: "Click to select multiple statistic quantities.",
                        disabled: "Statistic options are available only for non-point regions."
                    }}
                />
                <ProfileSelectionButtonComponent
                    categoryName={MultiProfileCategory.STOKES}
                    isActiveCategory={profileSelectionStore.activeProfileCategory === MultiProfileCategory.STOKES}
                    itemOptions={profileSelectionStore.coordinateOptions}
                    itemSelected={profileSelectionStore.selectedCoordinates}
                    isDisabled={isDisabled}
                    isOptionsDisabled={!frame?.hasStokes}
                    onCategorySelect={() => {
                        profileSelectionStore.setActiveProfileCategory(profileSelectionStore.activeProfileCategory !== MultiProfileCategory.STOKES ? MultiProfileCategory.STOKES : MultiProfileCategory.NONE);
                    }}
                    onItemSelect={this.onStokesItemClick}
                    categoryTooltip={
                        <span>
                            {`Click to enable/disable multiple selections of ${MultiProfileCategory.STOKES}`}
                            <span>
                                <br />
                                <i>
                                    <small>When enabled, Spectral Profiler will show multiple profiles with different selected Stokes.</small>
                                </i>
                            </span>
                        </span>
                    }
                    dropdownTooltip={{
                        nonActive: "Click to select a Stokes parameter.",
                        active: "Click to select multiple Stokes parameters.",
                        disabled: "There is no other Stokes parameter in the selected image."
                    }}
                />
            </div>
        );
    }
}

@observer
export class SpectralProfilerToolbarComponent extends React.Component<{widgetStore: SpectralProfileWidgetStore; id: string}> {
    private smoothingShortcutClick = () => {
        this.props.widgetStore.setSettingsTabId(SpectralProfilerSettingsTabs.SMOOTHING);
        AppStore.Instance.widgetsStore.createFloatingSettingsWidget(SpectralProfilerComponent.WidgetConfig.title ?? "", this.props.id, SpectralProfilerComponent.WidgetConfig.type);
    };

    private momentsShortcutClick = () => {
        this.props.widgetStore.setSettingsTabId(SpectralProfilerSettingsTabs.MOMENTS);
        AppStore.Instance.widgetsStore.createFloatingSettingsWidget(SpectralProfilerComponent.WidgetConfig.title ?? "", this.props.id, SpectralProfilerComponent.WidgetConfig.type);
    };

    private fittingShortcutClick = () => {
        this.props.widgetStore.setSettingsTabId(SpectralProfilerSettingsTabs.FITTING);
        AppStore.Instance.widgetsStore.createFloatingSettingsWidget(SpectralProfilerComponent.WidgetConfig.title ?? "", this.props.id, SpectralProfilerComponent.WidgetConfig.type);
    };

    public render() {
        const widgetStore = this.props.widgetStore;
        return (
            <div className="spectral-profiler-toolbar">
                <ProfileSelectionComponent profileSelectionStore={widgetStore.profileSelectionStore} />
                <ButtonGroup className="shortcut-buttons">
                    <Tooltip content="Smoothing">
                        <AnchorButton icon={<CustomIcon icon="smoothing" />} onClick={this.smoothingShortcutClick} data-testid="smoothing-button" />
                    </Tooltip>
                    <Tooltip content="Moments">
                        <AnchorButton icon={<CustomIcon icon="moments" />} onClick={this.momentsShortcutClick} data-testid="moment-generator-button" />
                    </Tooltip>
                    <Tooltip content="Fitting">
                        <AnchorButton icon={<CustomIcon icon="lineFitting" />} onClick={this.fittingShortcutClick} data-testid="profile-fitting-button" />
                    </Tooltip>
                </ButtonGroup>
            </div>
        );
    }
}
