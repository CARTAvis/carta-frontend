import * as React from "react";
import {observer} from "mobx-react";
import {action, makeObservable, observable} from "mobx";
import {ControlGroup, Divider, FormGroup, HTMLSelect, IOptionProps, NonIdealState, Pre, Spinner, Tab, TabId, Tabs, Text, Popover, PopperModifiers, Position, Button, InputGroup, ButtonGroup} from "@blueprintjs/core";
import {FixedSizeList as List} from "react-window";
import AutoSizer from "react-virtualized-auto-sizer";
import {CARTA} from "carta-protobuf";
import {TableComponent, TableComponentProps} from "components/Shared";
import "./FileInfoComponent.scss";

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
    HDUOptions?: {HDUList: IOptionProps[], handleSelectedHDUChange: (hdu: string) => void;},
    fileInfoExtended: CARTA.IFileInfoExtended,
    regionFileInfo: string,
    catalogFileInfo: CARTA.ICatalogFileInfo,
    selectedTab: TabId,
    handleTabChange: (tab: TabId) => void;
    isLoading: boolean,
    errorMessage: string,
    catalogHeaderTable?: TableComponentProps
}> {

    @observable searchString: string = "";
    @observable matchedTotal: number = 0;
    @observable isMouseEntered: boolean = false;
    @observable isSearchOpened: boolean = false;

    @action onMouseEnter = () => {
        this.isMouseEntered = true;
    };

    @action onMouseLeave = () => {
        if (!this.isSearchOpened) {
            this.isMouseEntered = false;
        }
    };

    @action searchOpened = () => {
        this.isSearchOpened = true;
    }

    @action searchClosed = () => {
        this.isSearchOpened = false;
        this.searchString = "";
    }

    @action addMatchedTotal = (matchedNum: number) => {
        this.matchedTotal += matchedNum;
    };

    constructor(props) {
        super(props);
        makeObservable(this);
    }

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

    private renderHDUList = () => {
        return this.props.HDUOptions && this.props.HDUOptions.HDUList?.length > 1 ? (
            <ControlGroup vertical={false}>
                <Divider/>
                <FormGroup inline={true} label="HDU">
                    <HTMLSelect options={this.props.HDUOptions.HDUList} onChange={(ev) => this.props.HDUOptions.handleSelectedHDUChange(ev.currentTarget.value)}/>
                </FormGroup>
            </ControlGroup>
        ) : undefined;
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
                return this.renderImageHeaderList(this.props.fileInfoExtended.computedEntries);
            case FileInfoType.IMAGE_HEADER:
                return this.renderImageHeaderList(this.props.fileInfoExtended.headerEntries, this.searchString);
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

    private highlightString(searchString: string, name: string, value?: string, comment?: string) {
        let testSubString = searchString;
        let splitString = (name !== "END") ? `${name} = ${value}${comment && " / "+comment}`.split(testSubString) : name.split(testSubString);
        
        let highlightedString = [];
        let highlighClassName = "";
        let keyIter = 0; // add unique keys to span to avoid warning
        if (name !== "END") {
            let classNameType = ["header-name", "header-value", "header-comment"];
            let classNameTypeIter = 0;
            let usedString = 0; 
            function addHighlightedString(addString: string, sliceStart: number, sliceEnd?: number): void {
                highlightedString.push(<span className={classNameType[classNameTypeIter]+highlighClassName} key={keyIter.toString()}>{isFinite(sliceEnd) ? addString.slice(sliceStart, sliceEnd) : addString.slice(sliceStart)}</span>);
                keyIter += 1;
                return;
            }
            splitString.forEach((arrayValue) => {

                highlighClassName = "";
                for (const addString of [arrayValue, this.searchString]) {
                    const formerUsedString = usedString;
                    const nameValueLength = name.length + 3 + value.length;
                    usedString += addString.length;;
                    if (comment && classNameTypeIter === 0 && usedString >= nameValueLength) {
                        addHighlightedString(addString, 0, name.length - formerUsedString);
                        classNameTypeIter += 1;
                        addHighlightedString(addString, name.length - formerUsedString, nameValueLength - formerUsedString);
                        classNameTypeIter += 1;
                        addHighlightedString(addString, nameValueLength - formerUsedString);

                    } else if (classNameTypeIter === 0 && usedString >= name.length ) {
                        addHighlightedString(addString, 0, name.length - formerUsedString);
                        classNameTypeIter += 1;
                        addHighlightedString(addString, name.length - formerUsedString);

                    } else if (comment && classNameTypeIter === 1 && usedString > nameValueLength) {
                        addHighlightedString(addString, 0, nameValueLength - formerUsedString);
                        classNameTypeIter += 1;
                        addHighlightedString(addString, nameValueLength - formerUsedString);

                    } else {
                        highlightedString.push(<span className={classNameType[classNameTypeIter]+highlighClassName} key={keyIter.toString()}>{addString}</span>);
                        keyIter += 1;
                    }
    
                    highlighClassName = " info-highlight";
                }
            });
        } else {
            splitString.forEach((value) => {

                highlighClassName = "";
                for (const string of [value,this.searchString]) {
                    highlightedString.push(<span className={"header-name"+highlighClassName} key={keyIter.toString()}>{string}</span>);
                    keyIter += 1;
                }
                highlighClassName = " info-highlight";
            });
        }
        highlightedString.pop();
        
        return highlightedString;
    }

    private renderImageHeaderList(entries: CARTA.IHeaderEntry[], searchString?: string) {
        const renderHeaderRow = ({index, style}) => {
            if (index < 0 || index >= entries?.length) {
                return null;
            }
            const header = entries[index];
            if ((searchString) && (searchString !== "")) {
                return (
                    <div style={style} className="header-entry">
                        {this.highlightString(searchString, header.name, header.value, header.comment)}
                    </div>
                );
            } else {
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
            }  
        };

        const numHeaders = entries?.length || 0;
        return (
            <AutoSizer>
                {({height, width}) => (
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

    @action private handleSearchStringChanged = (ev: React.ChangeEvent<HTMLInputElement>) => {
        this.searchString = ev.target.value;
    }

    private renderHeaderSearch = () => {
        const popoverModifiers: PopperModifiers = {arrow: {enabled: false}, offset: {offset: '0, 10px, 0, 0'}};
        let iterText = `0 of ${this.matchedTotal}`;
        const searchIter = (
            <ButtonGroup>
                <span className="header-search-iter">&nbsp;{iterText}&nbsp;</span>
                <Button icon="caret-left" minimal={true}></Button>
                <Button icon="caret-right" minimal={true}></Button>
            </ButtonGroup>
        );

        return (!this.props.isLoading && !this.props.errorMessage && this.props.fileInfoExtended &&
            this.props.selectedTab === FileInfoType.IMAGE_HEADER) ? (
            <Popover
                className="header-search"
                position={Position.LEFT}
                modifiers={popoverModifiers}
                onOpening={this.searchOpened}
                onClosing={this.searchClosed}
            >
                <Button icon="search-text" style={{opacity: (this.isMouseEntered) ? 1 : 0}}></Button>
                <InputGroup
                    autoFocus={false}
                    placeholder={"Search text"}
                    leftIcon="search-text"
                    rightElement={searchIter}
                    onChange={this.handleSearchStringChanged}
                />
            </Popover>
        ) : null;
    };

    render() {
        return (
            <div className="file-info" onMouseEnter={this.onMouseEnter} onMouseLeave={this.onMouseLeave}>
                <div className="file-info-panel-top">
                    {this.renderInfoTabs()}
                    {this.renderHDUList()}
                </div>
                {this.renderInfoPanel()}
                {this.renderHeaderSearch()}
            </div>
        );
    }
}
