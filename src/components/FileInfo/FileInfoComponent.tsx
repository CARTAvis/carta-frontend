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
    @observable matchedIter: number = 0;
    @observable matchedTotal: number = 0;
    @observable isMouseEntered: boolean = false;
    @observable isSearchOpened: boolean = false;
    @observable matchedIterLocation: {line: number, num: number} = {line: 0, num: 0};
    private splitStringArray: Array<Array<string>> = [];
    private listRef = React.createRef<any>();

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
    };

    @action searchClosed = () => {
        this.isSearchOpened = false;
        this.searchString = "";
        this.resetMatchedNums();
        this.matchedIterLocation = {line: 0, num: 0};
    };

    @action setSearchString = (inputSearchString: string) => {
        this.searchString = inputSearchString;
    };

    @action resetMatchedNums = () => {
        this.matchedTotal = 0;
        this.matchedIter = 0;
    };

    @action addMatchedIter = () => {
        if (this.matchedIter >= this.matchedTotal) {
            this.matchedIter = 1;
        } else {
            this.matchedIter += 1;
        }
    };

    @action minusMatchedIter = () => {
        if (this.matchedIter === 1){
            this.matchedIter = this.matchedTotal;
        } else {
            this.matchedIter -= 1;
        }
    };

    @action initMatchedIter = () => {
        this.matchedIter = (this.matchedTotal > 0) ? 1 : 0;
    };

    @action addMatchedTotal = (inputNum: number) => {
        this.matchedTotal += inputNum;
    };

    @action setMatchedIterLocation = (inputLine: number, inputNum: number) => {
        this.matchedIterLocation.line = inputLine;
        this.matchedIterLocation.num = inputNum;
    };

    private handleSearchStringChanged = (ev: React.ChangeEvent<HTMLInputElement>) => {
        this.setSearchString(ev.target.value);
        this.resetMatchedNums();
        
        // TODO: less strict search
        // TODO: debounce
        if (this.searchString !== ""){
            this.splitStringArray = [];
            let setScrollLineFlag = true;

            this.props.fileInfoExtended.headerEntries.forEach((entriesValue, index) => {
                let splitString = (entriesValue.name !== "END") ?
                    `${entriesValue.name} = ${entriesValue.value}${entriesValue.comment && " / "+entriesValue.comment}`.split(this.searchString) : entriesValue.name.split(this.searchString)
                this.splitStringArray.push(splitString);
                this.addMatchedTotal(splitString.length - 1);

                if (splitString.length > 1 && setScrollLineFlag) {
                    this.setMatchedIterLocation(index, 0);
                    setScrollLineFlag = false;
                }
            });

            this.initMatchedIter();
            this.listRef.current.scrollToItem(this.matchedIterLocation.line, "start");
        }
    };

    private calculateLocation = () => {
        let matchedNum = 0;
        for (let i = 0; i < this.splitStringArray.length; i++) {
            const length = this.splitStringArray[i].length - 1
            matchedNum += length;
            if(matchedNum >= this.matchedIter) {
                this.setMatchedIterLocation(i, this.matchedIter - matchedNum + length - 1);
                this.listRef.current.scrollToItem(this.matchedIterLocation.line, "smart");
                break;
            }
        }
    };

    private handleClickMatchedNext = () => {
        this.addMatchedIter();
        this.calculateLocation();
    }

    private handleClickMatchedPrev = () => {
        this.minusMatchedIter();
        this.calculateLocation();
    }

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
                            <TableComponent {...this.props.catalogHeaderTable}/>
                        </Pre>
                    );
                }
                return "";
            default:
                return "";
        }
    };

    private highlightString(index: number, name: string, value?: string, comment?: string) {
        const splitString = this.splitStringArray[index]

        if(!splitString || !name) {
            return null;
        }
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

            splitString.forEach((arrayValue, arrayIndex) => {
                highlighClassName = "";
                for (const addString of [arrayValue, this.searchString]) {
                    const formerUsedString = usedString;
                    const nameValueLength = name.length + 3 + value.length;
                    usedString += addString.length;

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

                    if ((index === this.matchedIterLocation.line) && (arrayIndex === this.matchedIterLocation.num)) {
                        highlighClassName = " info-highlight-selected";
                    } else {
                        highlighClassName = " info-highlight";
                    }
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

    private renderImageHeaderList(entries: CARTA.IHeaderEntry[]) {
        const renderHeaderRow = ({index, style}) => {
            if (index < 0 || index >= entries?.length) {
                return null;
            }
            const header = entries[index];
            if ((this.props.selectedTab === FileInfoType.IMAGE_HEADER) && (this.searchString !== "")) {
                return (
                    <div style={style} className="header-entry">
                        {this.highlightString(index, header.name, header.value, header.comment)}
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
                        ref={this.listRef}
                    >
                        {renderHeaderRow}
                    </List>
                )}
            </AutoSizer>
        );
    }

    private renderHeaderSearch = () => {
        const popoverModifiers: PopperModifiers = {arrow: {enabled: false}, offset: {offset: '0, 10px, 0, 0'}};
        let iterText = `${this.matchedIter} of ${this.matchedTotal}`;
        const searchIter = (
            <ButtonGroup className="header-search">
                <span className="header-search-iter">&nbsp;{iterText}&nbsp;</span>
                <Button
                    icon="caret-left"
                    minimal={true}
                    onClick={this.handleClickMatchedPrev}
                    disabled={(this.matchedIter === 0) || (this.matchedTotal === 1) ? true : false}
                />
                <Button
                    icon="caret-right"
                    minimal={true}
                    onClick={this.handleClickMatchedNext}
                    disabled={(this.matchedIter === 0) || (this.matchedTotal === 1) ? true : false}
                />
            </ButtonGroup>
        );

        return (!this.props.isLoading && !this.props.errorMessage && this.props.fileInfoExtended &&
            this.props.selectedTab === FileInfoType.IMAGE_HEADER) ? (
            <Popover
                className="header-search-button"
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
