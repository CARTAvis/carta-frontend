import {observer} from "mobx-react";
import * as React from "react";
import {CARTA} from "carta-protobuf";
import {AnchorButton, ButtonGroup, Intent, Menu, MenuItem, Popover, Position, Tooltip} from "@blueprintjs/core";
import {AppStore} from "stores";
import {MultiProfileCategory, SpectralProfileWidgetStore, SpectralProfileSelectionStore} from "stores/widgets";
import {SpectralProfilerComponent, SpectralProfilerSettingsTabs} from "components";
import {CustomIcon} from "icons/CustomIcons";
import {LineOption} from "models";
import "./SpectralProfilerToolbarComponent.scss";

type MultiSelectItem = string | CARTA.StatsType;

class ProfileSelectionButtonComponentProps {
    categoryName: MultiProfileCategory;
    isActiveCategory: boolean;
    itemOptions: LineOption[];
    itemSelected: MultiSelectItem[];
    disabled: boolean;
    disableOptions?: boolean;
    isSelectingSpecificItem?: boolean;
    categoryTooltip: JSX.Element;
    dropdownTooltip: {nonActive: string, active: string, disabled: string};
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
        if (!this.props.disabled && this.props.dropdownTooltip) {
            if (this.props.disableOptions) {
                dropdownHelpText = this.props.dropdownTooltip.disabled ?? "Selection is disabled.";
            } else if (this.props.isActiveCategory) {
                dropdownHelpText = this.props.dropdownTooltip.active ?? "Click to select multiple items.";
            } else {
                dropdownHelpText = this.props.dropdownTooltip.nonActive ?? "Click to select an item.";
            }
        }

        let className = "category-set";
        if (AppStore.Instance.darkTheme) {
            className += " bp3-dark";
        }

        return (
            <ButtonGroup fill={true} className={className}>
                <Tooltip content={this.props.categoryTooltip} position={Position.TOP}>
                    <AnchorButton
                        text={<span className={this.props.disableOptions ? "bp3-text-disabled" : ""}>{this.props.categoryName}</span>}
                        active={this.props.isActiveCategory}
                        onClick={(ev) => this.props.onCategorySelect()}
                        disabled={this.props.disabled}
                    />
                </Tooltip>
                <Popover
                    content={
                        <Menu>
                            {this.props.itemOptions?.map((item, index) =>
                                <MenuItem
                                    key={item.value}
                                    text={item.active ? <b>{item.label}</b> : item.label}
                                    disabled={item?.disabled}
                                    intent={item.hightlight ? Intent.PRIMARY : Intent.NONE}
                                    onClick={(ev) => this.props.onItemSelect(item.value, index)}
                                    icon={this.props.itemSelected?.includes(item.value) ? "tick" : "blank"}
                                    shouldDismissPopover={false}
                                />
                            )}
                        </Menu>
                    }
                    minimal={true}
                    placement={Position.BOTTOM}
                    disabled={this.props.disabled || this.props.disableOptions}
                >
                    <Tooltip content={dropdownHelpText} position={Position.TOP}>
                        <AnchorButton
                            text={<span className="overflow-text" title={dropdownText}>{this.props.isSelectingSpecificItem ? <b>{dropdownText}</b> : dropdownText}</span>}
                            className="dropdown-button"
                            rightIcon={"caret-down"}
                            disabled={this.props.disabled || this.props.disableOptions}
                        />
                    </Tooltip>
                </Popover>
            </ButtonGroup>
        );
    }
}

@observer
class ProfileSelectionComponent extends React.Component<{profileSelectionStore: SpectralProfileSelectionStore}> {
    // Frame selection does not allow multiple selection
    private onFrameItemClick = (selectedFrame: number, itemIndex: number) => {
        this.props.profileSelectionStore.selectFrame(selectedFrame);
    };

    private onRegionItemClick = (selectedRegion: number, itemIndex: number) => {
        const profileSelectionStore = this.props.profileSelectionStore;
        if (profileSelectionStore.activeProfileCategory !== MultiProfileCategory.REGION) {
            profileSelectionStore.selectRegionSingleMode(selectedRegion);
        } else {
            profileSelectionStore.selectRegionMultiMode(selectedRegion, itemIndex + 1);
        }
    };

    private onStatsItemClick = (selectedStatsType: CARTA.StatsType, itemIndex: number) => {
        const profileSelectionStore = this.props.profileSelectionStore;
        if (profileSelectionStore.activeProfileCategory !== MultiProfileCategory.STATISTIC) {
            profileSelectionStore.selectStatSingleMode(selectedStatsType);
        } else {
            profileSelectionStore.selectStatMultiMode(selectedStatsType, itemIndex + 1);
        }
    };

    private onStokesItemClick = (selectedStokes: string, itemIndex: number) => {
        const profileSelectionStore = this.props.profileSelectionStore;
        if (profileSelectionStore.activeProfileCategory !== MultiProfileCategory.STOKES) {
            profileSelectionStore.selectCoordinateSingleMode(selectedStokes);
        } else {
            profileSelectionStore.selectCoordinateMultiMode(selectedStokes, itemIndex + 1);
        }
    };

    public render() {
        const profileSelectionStore = this.props.profileSelectionStore;
        const frame = profileSelectionStore.selectedFrame;
        const disabled = !(frame?.channelInfo);

        return (
            <div className="profile-selection-panel">
                <ProfileSelectionButtonComponent
                    categoryName={MultiProfileCategory.IMAGE}
                    isActiveCategory={profileSelectionStore.activeProfileCategory === MultiProfileCategory.IMAGE}
                    itemOptions={profileSelectionStore.frameOptions}
                    itemSelected={[profileSelectionStore.selectedFrameWidgetFileId]}
                    disabled={disabled}
                    isSelectingSpecificItem={profileSelectionStore.isSelectingActiveFrame}
                    onCategorySelect={() => {
                        profileSelectionStore.setActiveProfileCategory(
                            profileSelectionStore.activeProfileCategory !== MultiProfileCategory.IMAGE ? MultiProfileCategory.IMAGE : MultiProfileCategory.NONE
                        );
                    }}
                    onItemSelect={this.onFrameItemClick}
                    categoryTooltip={
                        <span>
                            {`Click to enable/disable multiple profiles of ${MultiProfileCategory.IMAGE}`}
                            <span><br/><i><small>When enabled, Spectral Profiler will show multiple profiles from<br/>different images which are matched both spatially and spectrally.<br/>Toggle both spatial(XY) and spectral(Z) matching in Image List widget.</small></i></span>
                        </span>
                    }
                    dropdownTooltip={{
                        nonActive: "Click to select an image.",
                        active: "Click to select an image. Images matched by toggling both spatial(XY) and spectral(Z) matching via Image List widget are highlighted.",
                        disabled: undefined
                    }}
                />
                <ProfileSelectionButtonComponent
                    categoryName={MultiProfileCategory.REGION}
                    isActiveCategory={profileSelectionStore.activeProfileCategory === MultiProfileCategory.REGION}
                    itemOptions={profileSelectionStore.regionOptions}
                    itemSelected={profileSelectionStore.selectedRegionIds}
                    disabled={disabled}
                    isSelectingSpecificItem={profileSelectionStore.isSelectingActiveRegion}
                    onCategorySelect={() => {
                        profileSelectionStore.setActiveProfileCategory(
                            profileSelectionStore.activeProfileCategory !== MultiProfileCategory.REGION ? MultiProfileCategory.REGION : MultiProfileCategory.NONE
                        );
                    }}
                    onItemSelect={this.onRegionItemClick}
                    categoryTooltip={
                        <span>
                            {`Click to enable/disable multiple selections of ${MultiProfileCategory.REGION}`}
                            <span><br/><i><small>When enabled, Spectral Profiler will show multiple profiles from different selected regions.</small></i></span>
                        </span>
                    }
                    dropdownTooltip={{
                        nonActive: "Click to select a region.",
                        active: "Click to select multiple regions.",
                        disabled: undefined
                    }}
                />
                <ProfileSelectionButtonComponent
                    categoryName={MultiProfileCategory.STATISTIC}
                    isActiveCategory={profileSelectionStore.activeProfileCategory === MultiProfileCategory.STATISTIC}
                    itemOptions={profileSelectionStore.statsTypeOptions}
                    itemSelected={profileSelectionStore.isStatsTypeSelectionAvailable ? profileSelectionStore.selectedStatsTypes : [CARTA.StatsType.Mean]}
                    disabled={disabled}
                    disableOptions={!profileSelectionStore.isStatsTypeSelectionAvailable}
                    onCategorySelect={() => {
                        profileSelectionStore.setActiveProfileCategory(
                            profileSelectionStore.activeProfileCategory !== MultiProfileCategory.STATISTIC ? MultiProfileCategory.STATISTIC : MultiProfileCategory.NONE
                        );
                    }}
                    onItemSelect={this.onStatsItemClick}
                    categoryTooltip={
                        <span>
                            {`Click to enable/disable multiple selections of ${MultiProfileCategory.STATISTIC}`}
                            <span><br/><i><small>When enabled, Spectral Profiler will show multiple profiles with different selected statistic quantities.</small></i></span>
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
                    disabled={disabled}
                    disableOptions={!(frame?.hasStokes)}
                    onCategorySelect={() => {
                        profileSelectionStore.setActiveProfileCategory(
                            profileSelectionStore.activeProfileCategory !== MultiProfileCategory.STOKES ? MultiProfileCategory.STOKES : MultiProfileCategory.NONE
                        );
                    }}
                    onItemSelect={this.onStokesItemClick}
                    categoryTooltip={
                        <span>
                            {`Click to enable/disable multiple selections of ${MultiProfileCategory.STOKES}`}
                            <span><br/><i><small>When enabled, Spectral Profiler will show multiple profiles with different selected Stokes.</small></i></span>
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
                <ProfileSelectionComponent profileSelectionStore={widgetStore.profileSelectionStore}/>
                <ButtonGroup className="shortcut-buttons">
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
