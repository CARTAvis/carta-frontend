import {observer} from "mobx-react";
import * as React from "react";
import {CARTA} from "carta-protobuf";
import {AnchorButton, ButtonGroup, Icon, Intent, Menu, MenuItem, Popover, Position, Tooltip} from "@blueprintjs/core";
import {AppStore} from "stores";
import {MultiProfileCategory, SpectralProfileWidgetStore, SpectralProfileSelectionStore} from "stores/widgets";
import {SpectralProfilerComponent, SpectralProfilerSettingsTabs} from "components";
import {CustomIcon} from "icons/CustomIcons";
import {SWATCH_COLORS} from "utilities";
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
    tooltip: JSX.Element;
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

        return (
            <ButtonGroup fill={true} className="category-set">
                <Tooltip content={this.props.tooltip} position={Position.TOP}>
                    <AnchorButton
                        text={this.props.categoryName}
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
                                    text={item.label}
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
                    disabled={this.props.disabled}
                >
                    <AnchorButton
                        text={<span className="overflow-text">{dropdownText}</span>}
                        className="dropdown-button"
                        icon={this.props.isSelectingSpecificItem ? <Icon icon="star" iconSize={10}/> : undefined}
                        rightIcon={"caret-down"}
                        disabled={this.props.disabled || this.props.disableOptions}
                    />
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
            const color = SWATCH_COLORS[itemIndex % SWATCH_COLORS.length];
            profileSelectionStore.selectRegionMultiMode(selectedRegion, color);
        }
    };

    private onStatsItemClick = (selectedStatsType: CARTA.StatsType, itemIndex: number) => {
        const profileSelectionStore = this.props.profileSelectionStore;
        if (profileSelectionStore.activeProfileCategory !== MultiProfileCategory.STATISTIC) {
            profileSelectionStore.selectStatSingleMode(selectedStatsType);
        } else {
            const color = SWATCH_COLORS[itemIndex % SWATCH_COLORS.length];
            profileSelectionStore.selectStatMultiMode(selectedStatsType, color);
        }
    };

    private onStokesItemClick = (selectedStokes: string, itemIndex: number) => {
        const profileSelectionStore = this.props.profileSelectionStore;
        if (profileSelectionStore.activeProfileCategory !== MultiProfileCategory.STOKES) {
            profileSelectionStore.selectCoordinateSingleMode(selectedStokes);
        } else {
            const color = SWATCH_COLORS[itemIndex % SWATCH_COLORS.length];
            profileSelectionStore.selectCoordinateMultiMode(selectedStokes, color);
        }
    };

    public render() {
        const profileSelectionStore = this.props.profileSelectionStore;
        const frame = profileSelectionStore.selectedFrame;

        return (
            <div className="profile-selection-panel">
                <ProfileSelectionButtonComponent
                    categoryName={MultiProfileCategory.IMAGE}
                    isActiveCategory={profileSelectionStore.activeProfileCategory === MultiProfileCategory.IMAGE}
                    itemOptions={profileSelectionStore.frameOptions}
                    itemSelected={[profileSelectionStore.selectedFrameWidgetFileId]}
                    disabled={!frame}
                    isSelectingSpecificItem={profileSelectionStore.isSelectingActiveFrame}
                    onCategorySelect={() => {
                        profileSelectionStore.setActiveProfileCategory(
                            profileSelectionStore.activeProfileCategory !== MultiProfileCategory.IMAGE ? MultiProfileCategory.IMAGE : MultiProfileCategory.NONE
                        );
                    }}
                    onItemSelect={this.onFrameItemClick}
                    tooltip={
                        <span>
                            {`Click to enable/disable multiple profiles of ${MultiProfileCategory.IMAGE}`}
                            <span><br/><i><small>Spectral profiler shows the profiles of spatially and spectrally<br/>matched images related to the selected image when enabled.</small></i></span>
                        </span>
                    }
                />
                <ProfileSelectionButtonComponent
                    categoryName={MultiProfileCategory.REGION}
                    isActiveCategory={profileSelectionStore.activeProfileCategory === MultiProfileCategory.REGION}
                    itemOptions={profileSelectionStore.regionOptions}
                    itemSelected={profileSelectionStore.selectedRegionIds}
                    disabled={!frame}
                    isSelectingSpecificItem={profileSelectionStore.isSelectingActiveRegion}
                    onCategorySelect={() => {
                        profileSelectionStore.setActiveProfileCategory(
                            profileSelectionStore.activeProfileCategory !== MultiProfileCategory.REGION ? MultiProfileCategory.REGION : MultiProfileCategory.NONE
                        );
                    }}
                    onItemSelect={this.onRegionItemClick}
                    tooltip={
                        <span>
                            {`Click to enable/disable multiple profiles of ${MultiProfileCategory.REGION}`}
                            <span><br/><i><small>Spectral profiler shows the profiles of selected regions when enabled.</small></i></span>
                        </span>
                    }
                />
                <ProfileSelectionButtonComponent
                    categoryName={MultiProfileCategory.STATISTIC}
                    isActiveCategory={profileSelectionStore.activeProfileCategory === MultiProfileCategory.STATISTIC}
                    itemOptions={profileSelectionStore.statsTypeOptions}
                    itemSelected={profileSelectionStore.isStatsTypeSelectionAvailable ? profileSelectionStore.selectedStatsTypes : [CARTA.StatsType.Mean]}
                    disabled={!frame}
                    disableOptions={!profileSelectionStore.isStatsTypeSelectionAvailable}
                    onCategorySelect={() => {
                        profileSelectionStore.setActiveProfileCategory(
                            profileSelectionStore.activeProfileCategory !== MultiProfileCategory.STATISTIC ? MultiProfileCategory.STATISTIC : MultiProfileCategory.NONE
                        );
                    }}
                    onItemSelect={this.onStatsItemClick}
                    tooltip={
                        <span>
                            {`Click to enable/disable multiple profiles of ${MultiProfileCategory.STATISTIC}`}
                            <span><br/><i><small>Spectral profiler shows the profiles of selected statistics when enabled.</small></i></span>
                        </span>
                    }
                />
                <ProfileSelectionButtonComponent
                    categoryName={MultiProfileCategory.STOKES}
                    isActiveCategory={profileSelectionStore.activeProfileCategory === MultiProfileCategory.STOKES}
                    itemOptions={profileSelectionStore.coordinateOptions}
                    itemSelected={profileSelectionStore.selectedCoordinates}
                    disabled={!frame}
                    disableOptions={!(frame?.hasStokes)}
                    onCategorySelect={() => {
                        profileSelectionStore.setActiveProfileCategory(
                            profileSelectionStore.activeProfileCategory !== MultiProfileCategory.STOKES ? MultiProfileCategory.STOKES : MultiProfileCategory.NONE
                        );
                    }}
                    onItemSelect={this.onStokesItemClick}
                    tooltip={
                        <span>
                            {`Click to enable/disable multiple profiles of ${MultiProfileCategory.STOKES}`}
                            <span><br/><i><small>Spectral profiler shows the profiles of selected stokes when enabled.</small></i></span>
                        </span>
                    }
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
