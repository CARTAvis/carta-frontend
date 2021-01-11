import * as React from "react";
import { observer } from "mobx-react";
import { Pre, Tab, TabId, Tabs, NonIdealState, Spinner, Text, Label, FormGroup, IOptionProps, HTMLSelect, ControlGroup } from "@blueprintjs/core";
import { FixedSizeList as List } from "react-window";
import AutoSizer from "react-virtualized-auto-sizer";
import { CARTA } from "carta-protobuf";
import { SafeNumericInput, TableComponent, TableComponentProps } from "components/Shared";
import "./FileInfoComponent.scss";
import { AppStore } from "stores";
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

    private renderInfoPanel = () => {
        switch (this.props.selectedTab) {
            case FileInfoType.CHOP_IMAGE:
                return this.renderSaveImageControl();
            default:
                break;
        }
        if (this.props.isLoading) {
            return <NonIdealState className="non-ideal-state-file" icon={<Spinner className="astLoadingSpinner" />} title="Loading file info..." />;
        } else if (this.props.errorMessage) {
            return <NonIdealState className="non-ideal-state-file" icon="document" title="Cannot open file!" description={this.props.errorMessage + " Select another file from the folder."} />;
        } else if (!this.props.fileInfoExtended && !this.props.regionFileInfo && !this.props.catalogFileInfo) {
            return <NonIdealState className="non-ideal-state-file" icon="document" title="No file selected." description="Select a file from the folder." />;
        }
        switch (this.props.selectedTab) {
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

    private handleSaveSpectralValueStartChanged = (val: any) => {
        const fileBrowser = AppStore.Instance.fileBrowserStore;
        // if (-1 < val && val < fileBrowser.saveSpectralValueEnd) {
        fileBrowser.saveSpectralValueStart = val;
        // }
    };

    private handleSaveSpectralValueEndChanged = (val: any) => {
        const fileBrowser = AppStore.Instance.fileBrowserStore;
        // if (fileBrowser.saveSpectralValueStart < val && val < AppStore.Instance.activeFrame.channelValues.length) {
        fileBrowser.saveSpectralValueEnd = val;
        // }
    };

    private updateSpectralCoordinate(coordStr: string): void {
        const activeFrame = AppStore.Instance.activeFrame;
        const fileBrowser = AppStore.Instance.fileBrowserStore;
        if (activeFrame && activeFrame.spectralCoordsSupported && activeFrame.spectralCoordsSupported.has(coordStr)) {
            const coord: { type: SpectralType, unit: SpectralUnit } = activeFrame.spectralCoordsSupported.get(coordStr);
            activeFrame.spectralType = coord.type;
            activeFrame.spectralUnit = coord.unit;
            fileBrowser.saveSpectralValueStart = activeFrame.channelValueBounds.min;
            fileBrowser.saveSpectralValueEnd = activeFrame.channelValueBounds.max;
        }
    }

    private updateSpectralSystem(specsys: SpectralSystem): void {
        const activeFrame = AppStore.Instance.activeFrame;
        const fileBrowser = AppStore.Instance.fileBrowserStore;
        if (activeFrame && activeFrame.spectralSystemsSupported && activeFrame.spectralSystemsSupported.includes(specsys)) {
            activeFrame.spectralSystem = specsys;
            fileBrowser.saveSpectralValueStart = activeFrame.channelValueBounds.min;
            fileBrowser.saveSpectralValueEnd = activeFrame.channelValueBounds.max;
        }
    }

    private renderSaveImageControl() {
        const fileBrowser = AppStore.Instance.fileBrowserStore;
        const activeFrame = AppStore.Instance.activeFrame;
        const closedRegions = activeFrame.regionSet?.regions.filter(region => region.regionId > 0 && region.isClosedRegion);
        const regionOptions: IOptionProps[] = [{ value: 0, label: "Image" }].concat(closedRegions.map(region => ({ value: region.regionId, label: `${region.name ? region.name : region.regionId} (${CARTA.RegionType[region.regionType]})` })));

        const nativeSpectralCoordinate = activeFrame ? activeFrame.nativeSpectralCoordinate : undefined;
        const spectralCoordinateOptions: IOptionProps[] = activeFrame && activeFrame.spectralCoordsSupported ?
            Array.from(activeFrame.spectralCoordsSupported.keys()).map((coord: string) => { return { value: coord, label: coord === nativeSpectralCoordinate ? coord + " (Native WCS)" : coord }; }) : [];
        const spectralSystemOptions: IOptionProps[] = activeFrame && activeFrame.spectralSystemsSupported ? activeFrame.spectralSystemsSupported.map(system => { return { value: system, label: system }; }) : [];
        return (
            <React.Fragment>
                <div className="file-save">
                    <ControlGroup className="file-name" vertical={false}>
                        <Label className="label">{"Source"}</Label>
                        <Text className="text" ellipsize={true}>
                            {activeFrame.frameInfo.directory + "/" + activeFrame.frameInfo.fileInfo.name}
                        </Text>
                    </ControlGroup>
                    <ControlGroup className="region-select" fill={true} vertical={false}>
                        <Label className="label">{"Region"}</Label>
                        <HTMLSelect
                            value={fileBrowser.saveRegionId}
                            onChange={this.handleRegionChanged}
                            options={regionOptions}
                        />
                    </ControlGroup>
                    {activeFrame && activeFrame.numChannels > 1 &&
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
                                        <SafeNumericInput
                                            value={fileBrowser.saveSpectralValueStart}
                                            buttonPosition="none"
                                            placeholder="First channel"
                                            onValueChange={this.handleSaveSpectralValueStartChanged}
                                            min={activeFrame.channelValueBounds.min}
                                            max={activeFrame.channelValueBounds.max}
                                            clampValueOnBlur={true}
                                        />
                                        <Label>{"to"}</Label>
                                        <SafeNumericInput
                                            value={fileBrowser.saveSpectralValueEnd}
                                            buttonPosition="none"
                                            placeholder="Last channel"
                                            onValueChange={this.handleSaveSpectralValueEndChanged}
                                            min={activeFrame.channelValueBounds.min}
                                            max={activeFrame.channelValueBounds.max}
                                            clampValueOnBlur={true}
                                        />
                                    </ControlGroup>
                                </FormGroup>
                            </div>
                        </React.Fragment>
                    }
                    {activeFrame && activeFrame.hasStokes &&
                        <hr />
                    }
                </div>
            </React.Fragment>
        );
    }

    render() {
        return (
            <div className="file-info">
                {this.renderInfoTabs()}
                {this.renderInfoPanel()}
            </div>
        );
    }
}
