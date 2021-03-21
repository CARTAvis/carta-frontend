import {observer} from "mobx-react";
import * as React from "react";
import {AnchorButton, IOptionProps, Menu, MenuItem, Popover, Position, Tooltip} from "@blueprintjs/core";
import {ProfileCategory, SpectralProfileWidgetStore} from "stores/widgets";
import {CARTA} from "carta-protobuf";

type MultiSelectItem = string | CARTA.StatsType;
export interface ProfileItemOptionProps extends IOptionProps{
    disable?: boolean;
    hightlight?: boolean;
}

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
            <React.Fragment>
                <Tooltip content="Select to show multiple profiles" position={Position.TOP}>
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
                >
                    <AnchorButton rightIcon={"caret-down"} disabled={this.props.disabled}/>
                </Popover>
            </React.Fragment>
        );
    }
}

@observer
export class ProfileSelectionComponent extends React.Component<{widgetStore: SpectralProfileWidgetStore}> {
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

        let regionId = 0;

        if (widgetStore.effectiveFrame && widgetStore.effectiveFrame.regionSet) {
            regionId = widgetStore.effectiveRegionId;
            const selectedRegion = widgetStore.effectiveFrame.regionSet.regions.find(r => r.regionId === regionId);
            enableStatsSelect = (selectedRegion && selectedRegion.isClosedRegion);
        }

        return (
            <React.Fragment>
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
                    itemOptions={undefined}
                    itemSelected={multipleProfileStore.selectedRegions}
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
            </React.Fragment>
        );
    }
}
