import {observer} from "mobx-react";
import * as React from "react";
import {CARTA} from "carta-protobuf";
import {AnchorButton, ButtonGroup, IOptionProps, Menu, MenuItem, Popover, Position, Tooltip} from "@blueprintjs/core";
import {AppStore} from "stores";
import {ProfileCategory, SpectralProfileWidgetStore} from "stores/widgets";
import {SpectralProfilerComponent, SpectralProfilerSettingsTabs} from "components";
import {CustomIcon} from "icons/CustomIcons";
import "./SpectralProfilerToolbarComponent.scss";

export interface ProfileItemOptionProps extends IOptionProps{
    disable?: boolean;
    hightlight?: boolean;
}

type MultiSelectItem = string | CARTA.StatsType;

class ProfileSelectionButtonComponentProps {
    categoryName: ProfileCategory;
    isActiveCategory: boolean;
    itemOptions: ProfileItemOptionProps[];
    itemSelected: MultiSelectItem[];
    disabled: boolean;
    onCategorySelect: () => void;
    onItemSelect: (item: MultiSelectItem) => void;
}

@observer
class ProfileSelectionButtonComponent extends React.Component<ProfileSelectionButtonComponentProps> {
    public render() {
        return (
            <ButtonGroup fill={true} className="category-set">
                <Tooltip content={`Show multiple profiles - ${this.props.categoryName}`} position={Position.TOP}>
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
                            {this.props.itemOptions?.map((item) =>
                                <MenuItem
                                    key={item.value}
                                    text={item.label}
                                    disabled={item.disable}
                                    onClick={(ev) => this.props.onItemSelect(item.value)}
                                    icon={this.props.itemSelected?.includes(item.value) ? "tick" : "blank"}
                                    shouldDismissPopover={false}
                                />
                            )}
                        </Menu>
                    }
                    minimal={true}
                    placement={Position.BOTTOM}
                    disabled={!this.props.isActiveCategory || this.props.disabled}
                >
                    <AnchorButton rightIcon={"caret-down"} disabled={!this.props.isActiveCategory || this.props.disabled}/>
                </Popover>
            </ButtonGroup>
        );
    }
}

@observer
class ProfileSelectionComponent extends React.Component<{widgetStore: SpectralProfileWidgetStore}> {
    private onFrameItemClick = (selectedFrame: number) => {
        this.props.widgetStore.multipleProfileStore.selectFrame(selectedFrame);
    };

    private onRegionItemClick = (selectedRegion: number) => {
        this.props.widgetStore.multipleProfileStore.selectRegion(selectedRegion);
    };

    private onStatsItemClick = (selectedStatsType: CARTA.StatsType) => {
        this.props.widgetStore.multipleProfileStore.selectStatsType(selectedStatsType);
    };

    private onStokesItemClick = (selectedStokes: string) => {
        this.props.widgetStore.multipleProfileStore.selectCoordinate(selectedStokes);
    };

    public render() {
        const widgetStore = this.props.widgetStore;
        const multipleProfileStore = widgetStore.multipleProfileStore;

        let enableFrameSelect = true;
        let enableRegionSelect = true;
        let enableStatsSelect = false;

        if (widgetStore.effectiveFrame && widgetStore.effectiveFrame.regionSet) {
            const selectedRegion = widgetStore.effectiveFrame.regionSet.regions.find(r => r.regionId === widgetStore.effectiveRegionId);
            enableStatsSelect = (selectedRegion && selectedRegion.isClosedRegion);
        }

        return (
            <div className="profile-selection-panel">
                <ProfileSelectionButtonComponent
                    categoryName={ProfileCategory.IMAGE}
                    isActiveCategory={multipleProfileStore.profileCategory === ProfileCategory.IMAGE}
                    itemOptions={multipleProfileStore.frameOptions}
                    itemSelected={[multipleProfileStore.selectedFrameFileId]}
                    disabled={!enableFrameSelect}
                    onCategorySelect={() => multipleProfileStore.setProfileCategory(ProfileCategory.IMAGE)}
                    onItemSelect={this.onFrameItemClick}
                />
                <ProfileSelectionButtonComponent
                    categoryName={ProfileCategory.REGION}
                    isActiveCategory={multipleProfileStore.profileCategory === ProfileCategory.REGION}
                    itemOptions={multipleProfileStore.regionOptions}
                    itemSelected={multipleProfileStore.selectedRegionIds}
                    disabled={!enableRegionSelect}
                    onCategorySelect={() => multipleProfileStore.setProfileCategory(ProfileCategory.REGION)}
                    onItemSelect={this.onRegionItemClick}
                />
                <ProfileSelectionButtonComponent
                    categoryName={ProfileCategory.STATISTICS}
                    isActiveCategory={multipleProfileStore.profileCategory === ProfileCategory.STATISTICS}
                    itemOptions={multipleProfileStore.statsTypeOptions}
                    itemSelected={multipleProfileStore.selectedStatsTypes}
                    disabled={!enableStatsSelect}
                    onCategorySelect={() => multipleProfileStore.setProfileCategory(ProfileCategory.STATISTICS)}
                    onItemSelect={this.onStatsItemClick}
                />
                <ProfileSelectionButtonComponent
                    categoryName={ProfileCategory.STOKES}
                    isActiveCategory={multipleProfileStore.profileCategory === ProfileCategory.STOKES}
                    itemOptions={multipleProfileStore.coordinateOptions}
                    itemSelected={multipleProfileStore.selectedCoordinates}
                    disabled={!multipleProfileStore.selectedFrame?.hasStokes}
                    onCategorySelect={() => multipleProfileStore.setProfileCategory(ProfileCategory.STOKES)}
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
                <ProfileSelectionComponent widgetStore={widgetStore}/>
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
