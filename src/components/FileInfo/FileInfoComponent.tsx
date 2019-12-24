import * as React from "react";
import {observable} from "mobx";
import {Pre, Tab, TabId, Tabs, NonIdealState, Spinner} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import "./FileInfoComponent.css";

export enum InfoType {
    IMAGE_FILE = "image-file",
    IMAGE_HEADER = "image-header",
    REGION_FILE = "region-file"
}

export class FileInfoComponent extends React.Component<{
    infoTypes: InfoType[],
    fileInfoExtended: CARTA.IFileInfoExtended,
    regionFileInfo: string,
    selectedTab: TabId,
    handleTabChange: (tab: TabId) => void;
    isLoading: boolean,
    errorMessage: string,
}> {
    @observable selectedTab: TabId;

    private renderInfoTabs = () => {
        const infoTypes = this.props.infoTypes;
        const tabEntries = infoTypes.map(infoType => {
            if (InfoType.IMAGE_FILE === infoType || InfoType.REGION_FILE === infoType) {
                return <Tab id={infoType} title="File Information"/>;
            } else {
                return <Tab id={infoType} title="Header"/>;
            } 
        });
        return(
            <Tabs id="file-info-tabs" onChange={(value) => this.props.handleTabChange(value)} selectedTabId={this.selectedTab}>
                {tabEntries}
            </Tabs>
        );
    }

    private renderInfoPanel = () => {
        
        if (this.props.isLoading) {
            return <NonIdealState className="non-ideal-state-file" icon={<Spinner className="astLoadingSpinner"/>} title="Loading file info..."/>;
        } else if (this.props.errorMessage) {
            return <NonIdealState className="non-ideal-state-file" icon="document" title="Cannot open file!" description={this.props.errorMessage + " Select another file from the list on the left"}/>;
        } else if (!this.props.fileInfoExtended && !this.props.regionFileInfo) {
            return <NonIdealState className="non-ideal-state-file" icon="document" title="No file selected" description="Select a file from the list on the left"/>;
        }
        
        switch (this.selectedTab) {
            case InfoType.IMAGE_FILE:
                return <Pre className="file-info-pre">{this.getImageFileInfo(this.props.fileInfoExtended)}</Pre>;
            case InfoType.IMAGE_HEADER:
                return <Pre className="file-info-pre">{this.getImageHeaders(this.props.fileInfoExtended)}</Pre>;
            case InfoType.REGION_FILE:
                return <Pre className="file-info-pre">{this.props.regionFileInfo}</Pre>;
            default:
                return "";
        }
    }

    render() {
        this.selectedTab = (this.props.infoTypes.filter( infoType => infoType === this.props.selectedTab ).length > 0) ? this.props.selectedTab : this.props.infoTypes[0];

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
