import {observer} from "mobx-react";
import * as React from "react";
import {AnchorButton, IOptionProps, Menu, MenuItem, Popover, Position, Tooltip} from "@blueprintjs/core";
import {AppStore} from "stores";
import {ProfileCategory, SpectralProfileWidgetStore} from "stores/widgets";
import {CARTA} from "carta-protobuf";

type MultiSelectItem = string | CARTA.StatsType;
class ProfileSelectionButtonComponentProps {
    category: ProfileCategory;
    selectedCategory: ProfileCategory;
    itemOptions: IOptionProps[];
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
        this.props.widgetStore.selectFrame(selectedFrame);
    };

    private onRegionItemClick = (selectedRegion: number) => {
        this.props.widgetStore.selectRegion(selectedRegion);
    };

    private onStatsItemClick = (selectedStatsType: CARTA.StatsType) => {
        this.props.widgetStore.selectStatsType(selectedStatsType);
    };

    private onStokesItemClick = (selectedStokes: string) => {
        this.props.widgetStore.selectCoordinate(selectedStokes);
    };

    public render() {
        const widgetStore = this.props.widgetStore;

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

        const profileStatsOptions: IOptionProps[] = [
            {value: CARTA.StatsType.Sum, label: SpectralProfileWidgetStore.StatsTypeString(CARTA.StatsType.Sum)},
            {value: CARTA.StatsType.Mean, label: SpectralProfileWidgetStore.StatsTypeString(CARTA.StatsType.Mean)},
            {value: CARTA.StatsType.FluxDensity, label: SpectralProfileWidgetStore.StatsTypeString(CARTA.StatsType.FluxDensity)},
            {value: CARTA.StatsType.Sigma, label: SpectralProfileWidgetStore.StatsTypeString(CARTA.StatsType.Sigma)},
            {value: CARTA.StatsType.Min, label: SpectralProfileWidgetStore.StatsTypeString(CARTA.StatsType.Min)},
            {value: CARTA.StatsType.Max, label: SpectralProfileWidgetStore.StatsTypeString(CARTA.StatsType.Max)},
            {value: CARTA.StatsType.Extrema, label: SpectralProfileWidgetStore.StatsTypeString(CARTA.StatsType.Extrema)},
            {value: CARTA.StatsType.RMS, label: SpectralProfileWidgetStore.StatsTypeString(CARTA.StatsType.RMS)},
            {value: CARTA.StatsType.SumSq, label: SpectralProfileWidgetStore.StatsTypeString(CARTA.StatsType.SumSq)}
        ];

        return (
            <React.Fragment>
                <ProfileSelectionButtonComponent
                    category={ProfileCategory.IMAGE}
                    selectedCategory={widgetStore.selectedProfileCategory}
                    itemOptions={AppStore.Instance.frameNames}
                    itemSelected={[widgetStore.selectedFrame]}
                    disabled={!enableFrameSelect}
                    onCategorySelect={() => widgetStore.selectProfileCategory(ProfileCategory.IMAGE)}
                    onItemSelect={this.onFrameItemClick}
                />
                <ProfileSelectionButtonComponent
                    category={ProfileCategory.REGION}
                    selectedCategory={widgetStore.selectedProfileCategory}
                    itemOptions={undefined}
                    itemSelected={widgetStore.selectedRegions}
                    disabled={!enableRegionSelect}
                    onCategorySelect={() => widgetStore.selectProfileCategory(ProfileCategory.REGION)}
                    onItemSelect={this.onRegionItemClick}
                />
                <ProfileSelectionButtonComponent
                    category={ProfileCategory.STATISTICS}
                    selectedCategory={widgetStore.selectedProfileCategory}
                    itemOptions={profileStatsOptions}
                    itemSelected={widgetStore.selectedStatsTypes}
                    disabled={!enableStatsSelect}
                    onCategorySelect={() => widgetStore.selectProfileCategory(ProfileCategory.STATISTICS)}
                    onItemSelect={this.onStatsItemClick}
                />
                <ProfileSelectionButtonComponent
                    category={ProfileCategory.STOKES}
                    selectedCategory={widgetStore.selectedProfileCategory}
                    itemOptions={profileCoordinateOptions}
                    itemSelected={widgetStore.selectedCoordinates}
                    disabled={!enableStokesSelect}
                    onCategorySelect={() => widgetStore.selectProfileCategory(ProfileCategory.STOKES)}
                    onItemSelect={this.onStokesItemClick}
                />
            </React.Fragment>
        );
    }
}
