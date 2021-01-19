import * as React from "react";
import { observer } from "mobx-react";
import { Pre, Tab, TabId, Tabs, NonIdealState, Spinner, Text, Label, FormGroup, IOptionProps, HTMLSelect, ControlGroup, Divider, Switch, NumericInput } from "@blueprintjs/core";
import { FixedSizeList as List } from "react-window";
import AutoSizer from "react-virtualized-auto-sizer";
import { CARTA } from "carta-protobuf";
import { TableComponent, TableComponentProps } from "components/Shared";
import "./FileInfoComponent.scss";
import { AppStore, FileBrowserStore } from "stores";
import { SpectralSystem, SpectralType, SpectralUnit } from "models";

export enum FileInfoType {
    IMAGE_FILE = "image-file",
    IMAGE_HEADER = "image-header",
    CHOP_IMAGE = "chop-image",
    REGION_FILE = "region-file",
    CATALOG_FILE = "catalog-file",
    CATALOG_HEADER = "catalog-header"
}

@observer
export class FileInfoComponent extends React.Component<{
    infoTypes: FileInfoType[],
    HDUOptions?: { HDUList: IOptionProps[], handleSelectedHDUChange: (hdu: string) => void; },
    fileInfoExtended: CARTA.IFileInfoExtended,
    regionFileInfo: string,
    catalogFileInfo: CARTA.ICatalogFileInfo,
    selectedTab: TabId,
    handleTabChange: (tab: TabId) => void;
    isLoading: boolean,
    errorMessage: string,
    catalogHeaderTable?: TableComponentProps
}> {

    private renderInfoTabs = () => {
        const infoTypes = this.props.infoTypes;
        const tabEntries = infoTypes.map(infoType => {
            switch (infoType) {
                case (FileInfoType.IMAGE_FILE):
                    return <Tab key={infoType} id={infoType} title="File Information" />;
                case (FileInfoType.IMAGE_HEADER):
                    return <Tab key={infoType} id={infoType} title="Header" />;
                case (FileInfoType.CHOP_IMAGE):
                    return <Tab key={infoType} id={infoType} title="Save Image" />;
                case (FileInfoType.CATALOG_FILE):
                    return <Tab key={infoType} id={infoType} title="Catalog Information" />;
                case (FileInfoType.CATALOG_HEADER):
                    return <Tab key={infoType} id={infoType} title="Catalog Header" />;
                case (FileInfoType.REGION_FILE):
                    return <Tab key={infoType} id={infoType} title="Region Information" />;
                default:
                    return "";
            }
        });
        return (
            <Tabs id="file-info-tabs" onChange={(value) => this.props.handleTabChange(value)} selectedTabId={this.props.selectedTab}>
                {tabEntries}
            </Tabs>
        );
    };

    private renderHDUList = () => {
        return this.props.HDUOptions && this.props.HDUOptions.HDUList?.length > 1 ? (
            <ControlGroup vertical={false}>
                <Divider />
                <FormGroup inline={true} label="HDU">
                    <HTMLSelect options={this.props.HDUOptions.HDUList} onChange={(ev) => this.props.HDUOptions.handleSelectedHDUChange(ev.currentTarget.value)} />
                </FormGroup>
            </ControlGroup>
        ) : undefined;
    };

    private renderInfoPanel = () => {
        switch (this.props.selectedTab) {
            case FileInfoType.CHOP_IMAGE:
                break;
            default:
                if (this.props.isLoading) {
                    return <NonIdealState className="non-ideal-state-file" icon={<Spinner className="astLoadingSpinner" />} title="Loading file info..." />;
                } else if (this.props.errorMessage) {
                    return <NonIdealState className="non-ideal-state-file" icon="document" title="Cannot open file!" description={this.props.errorMessage + " Select another file from the folder."} />;
                } else if (!this.props.fileInfoExtended && !this.props.regionFileInfo && !this.props.catalogFileInfo) {
                    return <NonIdealState className="non-ideal-state-file" icon="document" title="No file selected." description="Select a file from the folder." />;
                }
                break;
        }
        switch (this.props.selectedTab) {
            case FileInfoType.CHOP_IMAGE:
                return this.renderSaveImageControl();
            case FileInfoType.IMAGE_FILE:
                return this.renderImageHeaderList(this.props.fileInfoExtended.computedEntries);
            case FileInfoType.IMAGE_HEADER:
                return this.renderImageHeaderList(this.props.fileInfoExtended.headerEntries);
            case FileInfoType.REGION_FILE:
                return <Pre className="file-info-pre">{this.props.regionFileInfo}</Pre>;
            case FileInfoType.CATALOG_FILE:
                return (
                    <Pre className="file-info-pre">
                        <Text>{this.props.catalogFileInfo.description}</Text>
                    </Pre>
                );
            case FileInfoType.CATALOG_HEADER:
                if (this.props.catalogHeaderTable) {
                    return (
                        <Pre className="file-header-table">
                            <TableComponent {...this.props.catalogHeaderTable} />
                        </Pre>
                    );
                }
                return "";
            default:
                return "";
        }
    };
    private onChangeIsDropDegeneratedAxes = () => {
        const fileBrowser = FileBrowserStore.Instance;
        fileBrowser.isDropDegeneratedAxes = !fileBrowser.isDropDegeneratedAxes;
    };

    private renderImageHeaderList(entries: CARTA.IHeaderEntry[]) {
        const renderHeaderRow = ({ index, style }) => {
            if (index < 0 || index >= entries?.length) {
                return null;
            }
            const header = entries[index];
            if (header.name === "END") {
                return <div style={style} className="header-name">{`${header.name}`}</div>;
            } else {
                return (
                    <div style={style} className="header-entry">
                        <span className="header-name">{header.name}</span>
                        <span className="header-value"> = {`${header.value}`}</span>
                        {header.comment && <span className="header-comment"> / {header.comment} </span>}
                    </div>
                );
            }
        };

        const numHeaders = entries?.length || 0;
        return (
            <AutoSizer>
                {({ height, width }) => (
                    <List
                        className="header-list bp3-code-block"
                        itemCount={numHeaders}
                        itemSize={18}
                        height={height}
                        width={width}
                    >
                        {renderHeaderRow}
                    </List>
                )}
            </AutoSizer>
        );
    }

    private handleRegionChanged = (changeEvent: React.ChangeEvent<HTMLSelectElement>) => {
        const fileBrowser = AppStore.Instance.fileBrowserStore;
        fileBrowser.saveRegionId = parseInt(changeEvent.target.value);
    };

    private handleSaveSpectralRangeStartChanged = (val: any) => {
        if (FileBrowserStore && isFinite(val)) {
            FileBrowserStore.Instance.saveSpectralRange[0] = val;
        }
    };

    private handleSaveSpectralRangeEndChanged = (val: any) => {
        if (FileBrowserStore && isFinite(val)) {
            FileBrowserStore.Instance.saveSpectralRange[1] = val;
        }
    };

    private handleSaveSpectralRangeDeltaChanged = (val: any) => {
        if (FileBrowserStore && isFinite(val)) {
            FileBrowserStore.Instance.saveSpectralRange[2] = val;
        }
    };

    private updateSpectralCoordinate(coordStr: string): void {
        const activeFrame = AppStore.Instance.activeFrame;
        if (activeFrame && activeFrame.spectralCoordsSupported && activeFrame.spectralCoordsSupported.has(coordStr)) {
            const coord: { type: SpectralType, unit: SpectralUnit } = activeFrame.spectralCoordsSupported.get(coordStr);
            activeFrame.spectralType = coord.type;
            activeFrame.spectralUnit = coord.unit;
            FileBrowserStore.Instance.updateIniSaveSpectralRange();
        }
    };

    private updateSpectralSystem(specsys: SpectralSystem): void {
        const activeFrame = AppStore.Instance.activeFrame;
        if (activeFrame && activeFrame.spectralSystemsSupported && activeFrame.spectralSystemsSupported.includes(specsys)) {
            activeFrame.spectralSystem = specsys;
            FileBrowserStore.Instance.updateIniSaveSpectralRange();
        }
    };

    private updateStokes(option: number): void {
        FileBrowserStore.Instance.saveStokesOption = option;
    };

    private updateStokesOptions = () => {
        const activeFrame = AppStore.Instance.activeFrame;
        const stokesInfo = activeFrame.stokesInfo;
        let options = [
            { value: 0, label: stokesInfo.join("") },
        ];
        if (activeFrame) {
            switch (stokesInfo.join("")) {
                case "IQ":
                    options.push({ value: 1, label: stokesInfo[0] });
                    options.push({ value: 2, label: stokesInfo[1] });
                    break;
                case "QU":
                    options.push({ value: 1, label: stokesInfo[0] });
                    options.push({ value: 2, label: stokesInfo[1] });
                    break;
                case "UV":
                    options.push({ value: 1, label: stokesInfo[0] });
                    options.push({ value: 2, label: stokesInfo[1] });
                    break;
                case "IQU":
                    options.push({ value: 1, label: stokesInfo[0] });
                    options.push({ value: 2, label: stokesInfo[1] });
                    options.push({ value: 3, label: stokesInfo[2] });
                    options.push({ value: 4, label: stokesInfo.slice(0, 2).join("") });
                    options.push({ value: 5, label: stokesInfo.slice(1, 3).join("") });
                    options.push({ value: 6, label: stokesInfo[0] + stokesInfo[2] });
                    break;
                case "QUV":
                    options.push({ value: 1, label: stokesInfo[0] });
                    options.push({ value: 2, label: stokesInfo[1] });
                    options.push({ value: 3, label: stokesInfo[2] });
                    options.push({ value: 4, label: stokesInfo.slice(0, 2).join("") });
                    options.push({ value: 5, label: stokesInfo.slice(1, 3).join("") });
                    options.push({ value: 6, label: stokesInfo[0] + stokesInfo[2] });
                    break;
                case "IQUV":
                    options.push({ value: 1, label: stokesInfo[0] });
                    options.push({ value: 2, label: stokesInfo[1] });
                    options.push({ value: 3, label: stokesInfo[2] });
                    options.push({ value: 4, label: stokesInfo.slice(0, 2).join("") });
                    options.push({ value: 5, label: stokesInfo.slice(1, 3).join("") });
                    options.push({ value: 6, label: stokesInfo[0] + stokesInfo[2] });
                    options.push({ value: 7, label: stokesInfo[3] });
                    options.push({ value: 8, label: stokesInfo.slice(2, 4).join("") });
                    options.push({ value: 9, label: stokesInfo.slice(0, 3).join("") });
                    options.push({ value: 10, label: stokesInfo[0] + stokesInfo[3] });
                    options.push({ value: 11, label: stokesInfo[1] + stokesInfo[3] });
                    options.push({ value: 12, label: stokesInfo.slice(1, 4).join("") });
                    break;
                default:
                    break;
            }
            return options;
        }
        return [];
    };

    private renderSaveImageControl() {
        const fileBrowser = FileBrowserStore.Instance;
        const activeFrame = AppStore.Instance.activeFrame;
        const closedRegions = activeFrame.regionSet?.regions.filter(region => region.regionId > 0 && region.isClosedRegion);
        const regionOptions: IOptionProps[] = [{ value: 0, label: "Image" }].concat(closedRegions.map(region => ({ value: region.regionId, label: `${region.name ? region.name : region.regionId} (${CARTA.RegionType[region.regionType]})` })));

        const nativeSpectralCoordinate = activeFrame ? activeFrame.nativeSpectralCoordinate : undefined;
        const spectralCoordinateOptions: IOptionProps[] = activeFrame && activeFrame.spectralCoordsSupported ?
            Array.from(activeFrame.spectralCoordsSupported.keys()).map((coord: string) => { return { value: coord, label: coord === nativeSpectralCoordinate ? coord + " (Native WCS)" : coord }; }) : [];
        const spectralSystemOptions: IOptionProps[] = activeFrame && activeFrame.spectralSystemsSupported ? activeFrame.spectralSystemsSupported.map(system => { return { value: system, label: system }; }) : [];
        const stokesOptions: IOptionProps[] = this.updateStokesOptions();
        const min = Math.min(activeFrame.channelValueBounds.max, activeFrame.channelValueBounds.min);
        const max = Math.max(activeFrame.channelValueBounds.max, activeFrame.channelValueBounds.min);
        const delta = (max - min) / (activeFrame.numChannels - 1);
        const majorStepSize = delta;
        const minorStepSize = delta * 0.1;
        return (
            <React.Fragment>
                {activeFrame &&
                    <div className="file-save">
                        <ControlGroup className="file-name" vertical={false}>
                            <Label className="label">{"Source"}</Label>
                            <Text className="text" ellipsize={true}>
                                {activeFrame.frameInfo.directory + "/" + activeFrame.frameInfo.fileInfo.name}
                            </Text>
                        </ControlGroup>
                        <ControlGroup className="region-select" vertical={false}>
                            <Label className="label">{"Region"}</Label>
                            <HTMLSelect
                                value={fileBrowser.saveRegionId}
                                onChange={this.handleRegionChanged}
                                options={regionOptions}
                            />
                        </ControlGroup>
                        {activeFrame.numChannels > 1 &&
                            <React.Fragment>
                                <div className="coordinate-select">
                                    <FormGroup inline={false}>
                                        <FormGroup label={"Coordinate"} inline={true}>
                                            <HTMLSelect
                                                value={activeFrame && (activeFrame.spectralCoordinate || "")}
                                                options={spectralCoordinateOptions}
                                                onChange={
                                                    (event: React.FormEvent<HTMLSelectElement>) =>
                                                        this.updateSpectralCoordinate(event.currentTarget.value as string)
                                                }
                                            />
                                        </FormGroup>
                                        <FormGroup label={"System"} inline={true} >
                                            <HTMLSelect
                                                value={activeFrame && (activeFrame.spectralSystem || "")}
                                                options={spectralSystemOptions}
                                                onChange={
                                                    (event: React.FormEvent<HTMLSelectElement>) =>
                                                        this.updateSpectralSystem(event.currentTarget.value as SpectralSystem)
                                                }
                                            />
                                        </FormGroup>
                                    </FormGroup>
                                </div>
                                <div className="range-select">
                                    <FormGroup label={"Spectral range"} labelInfo={activeFrame.spectralUnit ? `(${activeFrame.spectralUnit})` : ""} inline={false} >
                                        <ControlGroup fill={true} vertical={false}>
                                            <Label>{"from"}</Label>
                                            <NumericInput
                                                value={fileBrowser.saveSpectralRange[0]}
                                                buttonPosition="none"
                                                placeholder="First channel"
                                                onValueChange={this.handleSaveSpectralRangeStartChanged}
                                                stepSize={majorStepSize}
                                                minorStepSize={minorStepSize}
                                            />
                                            <Label>{"to"}</Label>
                                            <NumericInput
                                                value={fileBrowser.saveSpectralRange[1]}
                                                buttonPosition="none"
                                                placeholder="Last channel"
                                                onValueChange={this.handleSaveSpectralRangeEndChanged}
                                                stepSize={majorStepSize}
                                                minorStepSize={minorStepSize}
                                            />
                                            <Label>{"by"}</Label>
                                            <NumericInput
                                                value={fileBrowser.saveSpectralRange[2]}
                                                buttonPosition="none"
                                                placeholder="Channel stride"
                                                onValueChange={this.handleSaveSpectralRangeDeltaChanged}
                                                stepSize={majorStepSize}
                                                minorStepSize={minorStepSize}
                                                min={0}
                                            />
                                        </ControlGroup>
                                    </FormGroup>
                                </div>
                            </React.Fragment>
                        }
                        {activeFrame.hasStokes &&
                            <React.Fragment>
                                <div className="stokes-select">
                                    <FormGroup label={"Stokes"} inline={true}>
                                        <HTMLSelect
                                            value={fileBrowser.saveStokesOption || ""}
                                            options={stokesOptions}
                                            onChange={
                                                (event: React.FormEvent<HTMLSelectElement>) =>
                                                    this.updateStokes(parseInt(event.currentTarget.value))
                                            }
                                        />
                                    </FormGroup>
                                </div>
                            </React.Fragment>
                        }
                        <Switch
                            className="drop-degenerate"
                            checked={fileBrowser.isDropDegeneratedAxes}
                            label="Drop degenerated axes"
                            onChange={this.onChangeIsDropDegeneratedAxes}
                        />
                    </div>
                }
            </React.Fragment>
        );
    }

    render() {
        return (
            <div className="file-info">
                <div className="file-info-panel-top">
                    {this.renderInfoTabs()}
                    {this.renderHDUList()}
                </div>
                {this.renderInfoPanel()}
            </div>
        );
    }
}
