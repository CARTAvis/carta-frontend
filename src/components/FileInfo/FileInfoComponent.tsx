import * as React from "react";
import {observer} from "mobx-react";
import {Pre, Tab, TabId, Tabs, NonIdealState, Spinner, Text} from "@blueprintjs/core";
import {FixedSizeList as List} from "react-window";
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

    private static readonly MaxFormattedHeaders = 1000;
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
            } else {
                return <Tab key={infoType} id={infoType} title="Region Information"/>;
            }
        });
        return (
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
                return this.renderImageHeaderList(this.props.fileInfoExtended);
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
                            <TableComponent {...this.props.catalogHeaderTable}/>
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

    private renderImageHeaderList(fileInfoExtended: CARTA.IFileInfoExtended) {
        const numHeaders = fileInfoExtended?.headerEntries?.length || 0;

        const Row = ({index, style}) => (
            <div style={style}>{fileInfoExtended.headerEntries[index].name}</div>
        );

        return (
            <Pre>
                <List
                    itemCount={numHeaders}
                    itemSize={20}
                    height={200}
                    width={400}
                >
                    {Row}
                </List>
            </Pre>
        );
    }

    private getImageHeaders(fileInfoExtended: CARTA.IFileInfoExtended) {
        let headers = [];
        if (fileInfoExtended?.headerEntries) {
            let overflowHeaderText = "";
            const numFormattedHeaders = Math.min(fileInfoExtended.headerEntries.length, FileInfoComponent.MaxFormattedHeaders);

            // Add formatted headers as separate spans for name, value and comment
            for (let i = 0; i < numFormattedHeaders; i++) {
                const header = fileInfoExtended.headerEntries[i];
                if (header.name === "END") {
                    headers.push(<span key={headers.length} className="header-name">{`${header.name}`}</span>);
                } else {
                    headers.push(<span className="header-name" key={headers.length}>{header.name}</span>);
                    headers.push(<span key={headers.length} className="header-value"> = {`${header.value}`}</span>);
                    if (header.comment) {
                        headers.push(<span key={headers.length} className="header-comment">{` / ${header.comment}`}</span>);
                    }
                }
                headers.push(<br key={headers.length}/>);
            }

            // Add "overflow" headers into one long span
            for (let i = FileInfoComponent.MaxFormattedHeaders; i < fileInfoExtended.headerEntries.length; i++) {
                const header = fileInfoExtended.headerEntries[i];
                if (header.name === "END") {
                    overflowHeaderText += `${header.name}`;
                } else {
                    overflowHeaderText += `${header.name} = ${header.value}`;
                    if (header.comment) {
                        overflowHeaderText += ` / ${header.comment}`;
                    }
                }
                overflowHeaderText += "\n";
            }
            if (overflowHeaderText) {
                headers.push(<span key={headers.length} className="header-overflow">{overflowHeaderText}</span>);
            }
        }
        return headers;
    }
}
