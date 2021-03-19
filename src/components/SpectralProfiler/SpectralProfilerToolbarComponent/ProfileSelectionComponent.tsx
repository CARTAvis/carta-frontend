import {observer} from "mobx-react";
import {autorun} from "mobx";
import * as React from "react";
import {AnchorButton, IOptionProps, Menu, MenuItem, Popover, Position, Tooltip} from "@blueprintjs/core";
import {ProfileCategory, SpectralProfileWidgetStore} from "stores/widgets";
import {CARTA} from "carta-protobuf";

type MultiSelectItem = string | CARTA.StatsType;
interface ItemOptionProps extends IOptionProps{
    enable: boolean;
    hightlight?: boolean;
}

class ProfileSelectionButtonComponentProps {
    category: ProfileCategory;
    selectedCategory: ProfileCategory;
    itemOptions: ItemOptionProps[];
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
    private profileStatsOptions: ItemOptionProps[] = Array.from(SpectralProfileWidgetStore.StatsTypeNameMap.entries()).map(entry => {
        return {
            value: entry[0],
            label: entry[1],
            enable: true
        };
    });

    constructor(props) {
        super(props);

        // Update stats options according to selected option
        // Unit of Sum/Mean/Sigma/Min/Max/Extrema/RMS: Jy/beam
        // Unit of FluxDensity: Jy
        // Unit of SumSq: (Jy/beam)^2
        autorun(() => {
            const widgetStore = this.props.widgetStore;
            if (widgetStore.selectedStatsTypes?.length === 0) {
                this.profileStatsOptions.forEach(option => option.enable = true);
            } else if (widgetStore.selectedStatsTypes?.includes(CARTA.StatsType.FluxDensity)) {
                this.profileStatsOptions.forEach(option => option.enable = option.value === CARTA.StatsType.FluxDensity);
            } else if (widgetStore.selectedStatsTypes?.includes(CARTA.StatsType.SumSq)) {
                this.profileStatsOptions.forEach(option => option.enable = option.value === CARTA.StatsType.SumSq);
            } else {
                this.profileStatsOptions.forEach(option => option.enable = option.value !== CARTA.StatsType.FluxDensity && option.value !== CARTA.StatsType.SumSq);
            }
        });
    }

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

        return (
            <React.Fragment>
                <ProfileSelectionButtonComponent
                    category={ProfileCategory.IMAGE}
                    selectedCategory={widgetStore.selectedProfileCategory}
                    itemOptions={undefined/*AppStore.Instance.frameNames*/}
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
                    itemOptions={this.profileStatsOptions}
                    itemSelected={widgetStore.selectedStatsTypes}
                    disabled={!enableStatsSelect}
                    onCategorySelect={() => widgetStore.selectProfileCategory(ProfileCategory.STATISTICS)}
                    onItemSelect={this.onStatsItemClick}
                />
                <ProfileSelectionButtonComponent
                    category={ProfileCategory.STOKES}
                    selectedCategory={widgetStore.selectedProfileCategory}
                    itemOptions={undefined/*profileCoordinateOptions*/}
                    itemSelected={widgetStore.selectedCoordinates}
                    disabled={!enableStokesSelect}
                    onCategorySelect={() => widgetStore.selectProfileCategory(ProfileCategory.STOKES)}
                    onItemSelect={this.onStokesItemClick}
                />
            </React.Fragment>
        );
    }
}
