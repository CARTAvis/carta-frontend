import {observer} from "mobx-react";
import * as React from "react";
import {AnchorButton, IOptionProps, Menu, MenuItem, Popover, Position, Tooltip} from "@blueprintjs/core";
import {ProfileCategory, SpectralProfileWidgetStore} from "stores/widgets";
import {CARTA} from "carta-protobuf";

type MultiSelectItem = string | CARTA.StatsType;
export interface ProfileItemOptionProps extends IOptionProps{
    enable: boolean;
    hightlight?: boolean;
}

class ProfileSelectionButtonComponentProps {
    category: ProfileCategory;
    selectedCategory: ProfileCategory;
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
                        text={this.props.category}
                        active={this.props.selectedCategory === this.props.category}
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
                                    disabled={!item.enable}
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
        let enableStokesSelect = false;

        let regionId = 0;
        const profileCoordinateOptions = [{value: "z", label: "Current"}];

        if (widgetStore.effectiveFrame && widgetStore.effectiveFrame.regionSet) {
            regionId = widgetStore.effectiveRegionId;
            const selectedRegion = widgetStore.effectiveFrame.regionSet.regions.find(r => r.regionId === regionId);
            enableStatsSelect = (selectedRegion && selectedRegion.isClosedRegion);
            enableStokesSelect = widgetStore.effectiveFrame.hasStokes;
            const stokesInfo = widgetStore.effectiveFrame.stokesInfo;
            stokesInfo.forEach(stokes => profileCoordinateOptions.push({value: `${stokes}z`, label: stokes}));
        }

        return (
            <React.Fragment>
                <ProfileSelectionButtonComponent
                    category={ProfileCategory.IMAGE}
                    selectedCategory={multipleProfileStore.selectedProfileCategory}
                    itemOptions={undefined/*AppStore.Instance.frameNames*/}
                    itemSelected={[multipleProfileStore.selectedFrame]}
                    disabled={!enableFrameSelect}
                    onCategorySelect={() => multipleProfileStore.selectProfileCategory(ProfileCategory.IMAGE)}
                    onItemSelect={this.onFrameItemClick}
                />
                <ProfileSelectionButtonComponent
                    category={ProfileCategory.REGION}
                    selectedCategory={multipleProfileStore.selectedProfileCategory}
                    itemOptions={undefined}
                    itemSelected={multipleProfileStore.selectedRegions}
                    disabled={!enableRegionSelect}
                    onCategorySelect={() => multipleProfileStore.selectProfileCategory(ProfileCategory.REGION)}
                    onItemSelect={this.onRegionItemClick}
                />
                <ProfileSelectionButtonComponent
                    category={ProfileCategory.STATISTICS}
                    selectedCategory={multipleProfileStore.selectedProfileCategory}
                    itemOptions={multipleProfileStore.profileStatsOptions}
                    itemSelected={multipleProfileStore.selectedStatsTypes}
                    disabled={!enableStatsSelect}
                    onCategorySelect={() => multipleProfileStore.selectProfileCategory(ProfileCategory.STATISTICS)}
                    onItemSelect={this.onStatsItemClick}
                />
                <ProfileSelectionButtonComponent
                    category={ProfileCategory.STOKES}
                    selectedCategory={multipleProfileStore.selectedProfileCategory}
                    itemOptions={undefined/*profileCoordinateOptions*/}
                    itemSelected={multipleProfileStore.selectedCoordinates}
                    disabled={!enableStokesSelect}
                    onCategorySelect={() => multipleProfileStore.selectProfileCategory(ProfileCategory.STOKES)}
                    onItemSelect={this.onStokesItemClick}
                />
            </React.Fragment>
        );
    }
}
