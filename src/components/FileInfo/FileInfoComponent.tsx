import * as React from "react";
import {Pre, Tab, TabId, Tabs, NonIdealState, Spinner, Text} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import {TableComponent, TableComponentProps} from "components/Shared";
import "./FileInfoComponent.css";

export enum FileInfoType {
    IMAGE_FILE = "image-file",
    IMAGE_HEADER = "image-header",
    REGION_FILE = "region-file",
    CATALOG_FILE = "catalog-file",
    CATALOG_HEADER = "catalog-header"
}

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
            if (FileInfoType.IMAGE_FILE === infoType) {
                return <Tab key={infoType} id={infoType} title="File Information"/>;
            } else if (FileInfoType.IMAGE_HEADER === infoType) {
                return <Tab key={infoType} id={infoType} title="Header"/>;
            } else if (FileInfoType.CATALOG_FILE === infoType) {
                return <Tab key={infoType} id={infoType} title="Catalog Information"/>;    
            } else if (FileInfoType.CATALOG_HEADER === infoType) {
                return <Tab key={infoType} id={infoType} title="Catalog Header"/>;
            }
            else {
                return <Tab key={infoType} id={infoType} title="Region Information"/>;
            }
        });
        return(
            <Tabs id="file-info-tabs" onChange={(value) => this.props.handleTabChange(value)} selectedTabId={this.props.selectedTab}>
                {tabEntries}
            </Tabs>
        );
    };

    private renderInfoPanel = () => {
        if (this.props.isLoading) {
            return <NonIdealState className="non-ideal-state-file" icon={<Spinner className="astLoadingSpinner"/>} title="Loading file info..."/>;
        } else if (this.props.errorMessage) {
            return <NonIdealState className="non-ideal-state-file" icon="document" title="Cannot open file!" description={this.props.errorMessage + " Select another file from the folder."}/>;
        } else if (!this.props.fileInfoExtended && !this.props.regionFileInfo && !this.props.catalogFileInfo) {
            return <NonIdealState className="non-ideal-state-file" icon="document" title="No file selected." description="Select a file from the folder."/>;
        }
        switch (this.props.selectedTab) {
            case FileInfoType.IMAGE_FILE:
                return <Pre className="file-info-pre">{this.getImageFileInfo(this.props.fileInfoExtended)}</Pre>;
            case FileInfoType.IMAGE_HEADER:
                return <Pre className="file-info-pre">{this.getImageHeaders(this.props.fileInfoExtended)}</Pre>;
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
                            <TableComponent {... this.props.catalogHeaderTable}/>
                        </Pre>
                    ); 
                }
                return "";
            default:
                return "";
        }
    };

    render() {
        return (
            <div className="file-info">
                {this.renderInfoTabs()}
                {this.renderInfoPanel()}
            </div>
        );
    }

    private getImageFileInfo(fileInfoExtended: CARTA.IFileInfoExtended) {
        let fileInfo = "";
        if (fileInfoExtended && fileInfoExtended.computedEntries) {
            fileInfoExtended.computedEntries.forEach(header => {
                fileInfo += `${header.name} = ${header.value}\n`;
            });
        }
        return fileInfo;
    }

    private getImageHeaders(fileInfoExtended: CARTA.IFileInfoExtended) {
        let headers = "";
        if (fileInfoExtended && fileInfoExtended.headerEntries) {
            fileInfoExtended.headerEntries.forEach(header => {
                if (header.name === "END") {
                    headers += `${header.name}\n`;
                } else {
                    headers += `${header.name} = ${header.value}\n`;
                }
            });
        }
        return headers;
    }
}
