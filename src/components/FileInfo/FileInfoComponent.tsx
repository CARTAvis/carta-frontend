import * as React from "react";
import {observer} from "mobx-react";
import {action, makeObservable, observable} from "mobx";
import {Button, ButtonGroup, ControlGroup, Divider, FormGroup, HTMLSelect, InputGroup, IOptionProps, NonIdealState, Popover, PopoverInteractionKind, PopperModifiers, Position, Pre, Spinner, Tab, TabId, Tabs, Text} from "@blueprintjs/core";
import {FixedSizeList as List} from "react-window";
import AutoSizer from "react-virtualized-auto-sizer";
import {CARTA} from "carta-protobuf";
import {SimpleTableComponent, SimpleTableComponentProps} from "components/Shared";
import {ImageSaveComponent} from "components/Dialogs";
import "./FileInfoComponent.scss";
import {exportTxtFile} from "utilities";

export enum FileInfoType {
    IMAGE_FILE = "image-file",
    IMAGE_HEADER = "image-header",
    SAVE_IMAGE = "save-image",
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
    catalogHeaderTable?: SimpleTableComponentProps,
    selectedFile?: CARTA.IFileInfo | CARTA.ICatalogFileInfo
}> {

    @observable searchString: string = "";
    @observable matchedIter: number = 0;
    @observable isMouseEntered: boolean = false;

    private isSearchOpened: boolean = false;
    private matchedTotal: number = 0;
    private matchedIterLocation: {line: number, num: number} = {line: -1, num: -1};
    private selectedFile: CARTA.IFileInfo | CARTA.ICatalogFileInfo;
    private splitLengthArray: Array<Array<number>> = [];
    private matchedLocationArray: Array<{line: number, num: number}> = [];
    private listRef = React.createRef<any>();
    private clickMatchedTimer;
    private clickMatchedTimerStart;

    @action onMouseEnter = () => {
        this.isMouseEntered = true;
    };

    @action onMouseLeave = () => {
        this.isMouseEntered = false;
    };

    @action resetSearchString = () => {
        this.searchString = "";
    }

    @action setSearchString = (inputSearchString: string) => {
        this.searchString = inputSearchString.replace("\b", "");
    };

    @action resetMatchedIter = () => {
        this.matchedIter = 0;
    };

    @action addMatchedIter = () => {
        if (this.matchedIter === 0) {
            return;
        } else if (this.matchedIter >= this.matchedTotal) {
            this.matchedIter = 1;
        } else {
            this.matchedIter += 1;
        }
    };

    @action minusMatchedIter = () => {
        if (this.matchedIter === 0){
            return;
        } else if (this.matchedIter === 1) {
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

    private updateMatchedIterLocation = () => {
        this.matchedIterLocation = (this.matchedTotal > 0) ? this.matchedLocationArray[this.matchedIter - 1] : {line: -1, num: -1};
    };

    // scrollToItem() scroll to positions without the effect of padding
    // calculate the correct positions and use scrollTo() instead
    private scrollToPosition = () => {
        const listRefCurrent = this.listRef.current;
        if (!listRefCurrent) {
            return;
        }
        const origOffset = listRefCurrent.state.scrollOffset;
        const height = listRefCurrent.props.height;
        const itemSize = listRefCurrent.props.itemSize;
        const targetPosition = 10 + this.matchedIterLocation.line * itemSize;
        if (targetPosition > origOffset + height - itemSize || targetPosition < origOffset) {
            this.listRef.current.scrollTo(targetPosition - height / 2);
        }
    };

    private handleSearchPanelClicked = (opened: boolean) => {
        this.isSearchOpened = opened ? true : false;
        this.resetSearchString();
        this.resetMatchedIter();
        this.matchedTotal = 0;
        this.matchedIterLocation = {line: -1, num: -1};
    };

    private handleSearchStringChanged = (ev: React.ChangeEvent<HTMLInputElement>) => {
        this.setSearchString(ev.target.value);
        this.resetMatchedIter();
        this.matchedTotal = 0;

        if (this.searchString !== "") {
            // RegExp ignores the difference of lettercase; use special characters as normal strings by putting \ in the front
            const searchStringRegExp = new RegExp(this.searchString.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
            this.splitLengthArray = [];
            this.matchedLocationArray = [];

            this.props.fileInfoExtended.headerEntries.forEach((entriesValue, index) => {
                let splitString = (entriesValue.name !== "END") ?
                    `${entriesValue.name} = ${entriesValue.value}${entriesValue.comment && " / " + entriesValue.comment}`.split(searchStringRegExp) : entriesValue.name.split(searchStringRegExp);
                this.splitLengthArray.push(splitString.map(value => value.length));
                this.matchedTotal += splitString.length - 1;
                if (splitString.length > 1) {
                    let numIter = 0;
                    while (numIter < splitString.length - 1) {
                        this.matchedLocationArray.push({line: index, num: numIter});
                        numIter += 1;
                    }
                }
            });

            this.initMatchedIter();
            this.updateMatchedIterLocation();
            this.scrollToPosition();
        }
    };

    // mode 1/-1: one step forward/backward, 99/-99: continuously forward/backward, 0: stop
    private handleClickMatched = (mode: number, keyEvent?) => {
        if ((keyEvent && keyEvent?.keyCode !== 13) || this.searchString === "") {
            return;
        }
        if (mode === 0) {
            clearTimeout(this.clickMatchedTimerStart);
            clearInterval(this.clickMatchedTimer);
        } else {
            let clickMatched = () => {
                if (mode === -1 || mode === -99) {
                    this.minusMatchedIter();
                } else {
                    this.addMatchedIter();
                }
                this.updateMatchedIterLocation();
                this.scrollToPosition();
            }

            if (mode === 99 || mode === -99) {
                clickMatched();
                this.clickMatchedTimerStart = setTimeout(() => {
                    this.clickMatchedTimer = setInterval(clickMatched, 100);
                }, 500);
            } else if (mode === 1 || mode === -1) {
                clickMatched();
            } else {
                return;
            }
        }
    };

    constructor(props) {
        super(props);
        makeObservable(this);
    }

    private renderInfoTabs = () => {
        const infoTypes = this.props.infoTypes;
        const tabEntries = infoTypes.map(infoType => {
            switch (infoType) {
                case (FileInfoType.IMAGE_FILE):
                    return <Tab key={infoType} id={infoType} title="File Information" />;
                case (FileInfoType.IMAGE_HEADER):
                    return <Tab key={infoType} id={infoType} title="Header" />;
                case (FileInfoType.SAVE_IMAGE):
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
                <Divider/>
                <FormGroup inline={true} label="HDU">
                    <HTMLSelect options={this.props.HDUOptions.HDUList} onChange={(ev) => this.props.HDUOptions.handleSelectedHDUChange(ev.currentTarget.value)}/>
                </FormGroup>
            </ControlGroup>
        ) : undefined;
    };

    private renderInfoPanel = () => {
        switch (this.props.selectedTab) {
            // Here is only controls for save, no need to wait file info
            case FileInfoType.SAVE_IMAGE:
                break;
            // Check if loading file
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
            case FileInfoType.SAVE_IMAGE:
                return (<ImageSaveComponent />);
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
                            <SimpleTableComponent {...this.props.catalogHeaderTable}/>
                        </Pre>
                    );
                }
                return "";
            default:
                return "";
        }
    };

    private highlightString = (index: number, name: string, value?: string, comment?: string) => {

        if(!isFinite(index) || index < 0 || !name) {
            return null;
        }

        const splitLength = this.splitLengthArray[index]
        const nameValueLength = name.length + 3 + value.length;
        let highlightedString = [];
        let keyIter = 0; // add unique keys to span to avoid warning
        let highlightClassName = "";
        let typeClassName = "header-name";
        let usedLength = 0;

        let addHighlightedString = (sliceStart: number, sliceEnd: number) => {
            if(!isFinite(sliceStart) || !isFinite(sliceEnd)) {
                return;
            }
            highlightedString.push(<span className={typeClassName + highlightClassName} key={keyIter.toString()}>
                {((name !== "END") ? `${name} = ${value}${comment && " / " + comment}` : name).slice(sliceStart, sliceEnd)}</span>);
            keyIter += 1;
            return;
        };

        splitLength.forEach((arrayValue, arrayIndex) => {
            highlightClassName = "";
            for (const addLength of [arrayValue, this.searchString.length]) {
                const formerUsedLength = usedLength;
                usedLength += addLength;

                if (name === "END") {
                    addHighlightedString(formerUsedLength, formerUsedLength + addLength);
                    // the string includes name, value, and comment
                } else if (comment && typeClassName === "header-name" && usedLength >= nameValueLength) {
                    addHighlightedString(formerUsedLength, name.length);
                    typeClassName = "header-value";
                    addHighlightedString(name.length, nameValueLength);
                    typeClassName = "header-comment";
                    addHighlightedString(nameValueLength, formerUsedLength + addLength);
                    // the string includes name and value
                } else if (typeClassName === "header-name" && usedLength >= name.length) {
                    addHighlightedString(formerUsedLength, name.length);
                    typeClassName = "header-value";
                    addHighlightedString(name.length, formerUsedLength + addLength);
                    // the string includes value and comment
                } else if (comment && typeClassName === "header-value" && usedLength > nameValueLength) {
                    addHighlightedString(formerUsedLength, nameValueLength);
                    typeClassName = "header-comment";
                    addHighlightedString(nameValueLength, formerUsedLength + addLength);
                } else {
                    addHighlightedString(formerUsedLength, formerUsedLength + addLength);
                }

                if (index === this.matchedIterLocation.line && arrayIndex === this.matchedIterLocation.num) {
                    highlightClassName = " info-highlight-selected";
                } else {
                    highlightClassName = " info-highlight";
                }
            }
        });
        highlightedString.pop();
        return highlightedString;
    }

    private renderImageHeaderList = (entries: CARTA.IHeaderEntry[]) => {
        if (this.props.selectedFile !== this.selectedFile) {
            this.isSearchOpened = false;
        }
        this.selectedFile = this.props.selectedFile;

        const renderHeaderRow = ({index, style}) => {
            if (index < 0 || index >= entries?.length) {
                return null;
            }
            const header = entries[index];
            if (this.isSearchOpened && this.props.selectedTab === FileInfoType.IMAGE_HEADER && this.searchString !== "") {
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
    };

    private renderHeaderToolbar = () => {
        const popoverModifiers: PopperModifiers = {arrow: {enabled: false}, offset: {offset: '0, 10px, 0, 0'}};
        const searchIter = (
            <ButtonGroup className="header-search">
                <span className="header-search-iter">&nbsp;{this.matchedIter} of {this.matchedTotal}&nbsp;</span>
                <Button
                    icon="caret-left"
                    minimal={true}
                    onMouseDown={() => this.handleClickMatched(-99)}
                    onMouseUp={() => this.handleClickMatched(0)}
                    onKeyDown={(ev) => this.handleClickMatched(-1, ev)}
                    disabled={this.matchedIter === 0 || this.matchedTotal === 1 ? true : false}
                />
                <Button
                    icon="caret-right"
                    minimal={true}
                    onMouseDown={() => this.handleClickMatched(99)}
                    onMouseUp={() => this.handleClickMatched(0)}
                    onKeyDown={(ev) => this.handleClickMatched(1, ev)}
                    disabled={this.matchedIter === 0 || this.matchedTotal === 1 ? true : false}
                />
            </ButtonGroup>
        );

        return (!this.props.isLoading && !this.props.errorMessage && this.props.fileInfoExtended &&
            this.props.selectedTab === FileInfoType.IMAGE_HEADER) ? (
                <ButtonGroup className="header-search-button" style={{opacity: (this.isMouseEntered || this.isSearchOpened) ? 1 : 0}}>
                    <Popover
                    position={Position.LEFT}
                    interactionKind={PopoverInteractionKind.CLICK_TARGET_ONLY}
                    modifiers={popoverModifiers}
                    onOpening={() => this.handleSearchPanelClicked(true)}
                    onClosing={() => this.handleSearchPanelClicked(false)}
                    >
                    <Button icon="search-text"></Button>
                    <InputGroup
                        className="header-search-input"
                        autoFocus={true}
                        placeholder={"Search text"}
                        leftIcon="search-text"
                        rightElement={searchIter}
                        onChange={this.handleSearchStringChanged}
                        onKeyDown={(ev) => this.handleClickMatched(1, ev)}
                    />
                    </Popover>
                    <Button icon="import" onClick={this.exportHeader}></Button>
                </ButtonGroup>
            ) : null;
    };

    private exportHeader = () => {
        const headerContent = this.props.fileInfoExtended.headerEntries;
        const imageName = `${this.props.fileInfoExtended.computedEntries[0].value}-Header`;
        let content = "";
        content += `# ${this.props.fileInfoExtended.computedEntries[0].value}\n`
        headerContent.forEach((row, index) => {
            if (row.comment){
                content += `${row.name} = ${row.value} / ${row.comment}\n`;
            } else {
                content += `${row.name} = ${row.value}\n`;
            }
        });
        exportTxtFile(imageName, content);
    };

    render() {
        return (
            <div className="file-info" onMouseEnter={this.onMouseEnter} onMouseLeave={this.onMouseLeave}>
                <div className="file-info-panel-top">
                    {this.renderInfoTabs()}
                    {this.renderHDUList()}
                </div>
                {this.renderInfoPanel()}
                {this.renderHeaderToolbar()}
            </div>
        );
    }
}
