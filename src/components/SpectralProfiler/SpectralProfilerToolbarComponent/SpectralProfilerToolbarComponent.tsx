import {observer} from "mobx-react";
import * as React from "react";
import {CARTA} from "carta-protobuf";
import {AnchorButton, ButtonGroup, Intent, IOptionProps, Menu, MenuItem, Popover, Position, Tooltip} from "@blueprintjs/core";
import {AppStore} from "stores";
import {ProfileCategory, SpectralProfileWidgetStore, SpectralProfileSelectionStore} from "stores/widgets";
import {SpectralProfilerComponent, SpectralProfilerSettingsTabs} from "components";
import {CustomIcon} from "icons/CustomIcons";
import {SWATCH_COLORS} from "utilities";
import "./SpectralProfilerToolbarComponent.scss";

export interface ProfileItemOptionProps extends IOptionProps{
    hightlight?: boolean;
}

type MultiSelectItem = string | CARTA.StatsType;

class ProfileSelectionButtonComponentProps {
    categoryName: ProfileCategory;
    isActiveCategory: boolean;
    itemOptions: ProfileItemOptionProps[];
    itemSelected: MultiSelectItem[];
    disabled: boolean;
    disableOptions?: boolean;
    onCategorySelect: () => void;
    onItemSelect: (item: MultiSelectItem, itemIndex: number, isMultipleSelectionMode: boolean) => void;
}

@observer
class ProfileSelectionButtonComponent extends React.Component<ProfileSelectionButtonComponentProps> {
    public render() {
        return (
            <ButtonGroup fill={true} className="category-set">
                <Tooltip content={"Click to show multiple profiles"} position={Position.TOP}>
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
                                    disabled={this.props.disableOptions}
                                    intent={item.hightlight ? Intent.PRIMARY : Intent.NONE}
                                    onClick={(ev) => this.props.onItemSelect(item.value, index, this.props.isActiveCategory)}
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
                    <AnchorButton rightIcon={"caret-down"} disabled={this.props.disabled}/>
                </Popover>
            </ButtonGroup>
        );
    }
}

@observer
class ProfileSelectionComponent extends React.Component<{profileSelectionStore: SpectralProfileSelectionStore}> {
    // Frame selection does not allow multiple selection
    private onFrameItemClick = (selectedFrame: number, itemIndex: number, isMultipleSelectionMode: boolean) => {
        this.props.profileSelectionStore.selectFrame(selectedFrame);
    };

    private onRegionItemClick = (selectedRegion: number, itemIndex: number, isMultipleSelectionMode: boolean) => {
        const color = SWATCH_COLORS[itemIndex % SWATCH_COLORS.length];
        this.props.profileSelectionStore.selectRegion(selectedRegion, color, isMultipleSelectionMode);
    };

    private onStatsItemClick = (selectedStatsType: CARTA.StatsType, itemIndex: number, isMultipleSelectionMode: boolean) => {
        const color = SWATCH_COLORS[itemIndex % SWATCH_COLORS.length];
        this.props.profileSelectionStore.selectStatsType(selectedStatsType, color, isMultipleSelectionMode);
    };

    private onStokesItemClick = (selectedStokes: string, itemIndex: number, isMultipleSelectionMode: boolean) => {
        const color = SWATCH_COLORS[itemIndex % SWATCH_COLORS.length];
        this.props.profileSelectionStore.selectCoordinate(selectedStokes, color, isMultipleSelectionMode);
    };

    public render() {
        const profileSelectionStore = this.props.profileSelectionStore;
        const frame = profileSelectionStore.selectedFrame;

        return (
            <div className="profile-selection-panel">
                <ProfileSelectionButtonComponent
                    categoryName={ProfileCategory.IMAGE}
                    isActiveCategory={profileSelectionStore.activeProfileCategory === ProfileCategory.IMAGE}
                    itemOptions={profileSelectionStore.frameOptions}
                    itemSelected={[profileSelectionStore.selectedFrameFileId]}
                    disabled={!frame}
                    onCategorySelect={() => profileSelectionStore.setActiveProfileCategory(ProfileCategory.IMAGE)}
                    onItemSelect={this.onFrameItemClick}
                />
                <ProfileSelectionButtonComponent
                    categoryName={ProfileCategory.REGION}
                    isActiveCategory={profileSelectionStore.activeProfileCategory === ProfileCategory.REGION}
                    itemOptions={profileSelectionStore.regionOptions}
                    itemSelected={profileSelectionStore.selectedRegionIds}
                    disabled={!frame}
                    onCategorySelect={() => profileSelectionStore.setActiveProfileCategory(ProfileCategory.REGION)}
                    onItemSelect={this.onRegionItemClick}
                />
                <ProfileSelectionButtonComponent
                    categoryName={ProfileCategory.STATISTICS}
                    isActiveCategory={profileSelectionStore.activeProfileCategory === ProfileCategory.STATISTICS}
                    itemOptions={profileSelectionStore.statsTypeOptions}
                    itemSelected={profileSelectionStore.selectedStatsTypes}
                    disabled={!frame}
                    disableOptions={!profileSelectionStore.isStatsTypeSelectionAvailable}
                    onCategorySelect={() => profileSelectionStore.setActiveProfileCategory(ProfileCategory.STATISTICS)}
                    onItemSelect={this.onStatsItemClick}
                />
                <ProfileSelectionButtonComponent
                    categoryName={ProfileCategory.STOKES}
                    isActiveCategory={profileSelectionStore.activeProfileCategory === ProfileCategory.STOKES}
                    itemOptions={profileSelectionStore.coordinateOptions}
                    itemSelected={profileSelectionStore.selectedCoordinates}
                    disabled={!(frame?.hasStokes)}
                    onCategorySelect={() => profileSelectionStore.setActiveProfileCategory(ProfileCategory.STOKES)}
                    onItemSelect={this.onStokesItemClick}
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
