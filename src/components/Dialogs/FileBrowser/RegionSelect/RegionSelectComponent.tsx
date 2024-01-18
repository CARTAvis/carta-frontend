import * as React from "react";
import AutoSizer from "react-virtualized-auto-sizer";
import {FixedSizeList as List} from "react-window";
import {Checkbox, Icon, IconName} from "@blueprintjs/core";
import {computed, makeObservable} from "mobx";
import {Observer, observer} from "mobx-react";

import {CustomIcon, CustomIconName} from "icons/CustomIcons";
import {FileBrowserStore, SelectionMode} from "stores";

import "./RegionSelectComponent.scss";

@observer
export class RegionSelectComponent extends React.Component {
    @computed private get isSelectAll(): boolean {
        const fileBrowserStore = FileBrowserStore.Instance;
        return fileBrowserStore.exportRegionNum === fileBrowserStore.regionOptionNum && fileBrowserStore.regionOptionNum > 0;
    }

    @computed private get isSelectAllAnnotations(): boolean {
        const fileBrowserStore = FileBrowserStore.Instance;
        return fileBrowserStore.exportAnnotationNum === fileBrowserStore.annotationOptionNum && fileBrowserStore.annotationOptionNum > 0;
    }

    @computed private get isSelectAllRegions(): boolean {
        const fileBrowserStore = FileBrowserStore.Instance;
        const regionNum = fileBrowserStore.regionOptionNum - fileBrowserStore.annotationOptionNum;
        return fileBrowserStore.exportRegionNum - fileBrowserStore.exportAnnotationNum === regionNum && regionNum > 0;
    }

    @computed private get isIndeterminateSelectAll(): boolean {
        const fileBrowserStore = FileBrowserStore.Instance;
        return fileBrowserStore.exportRegionNum > 0 && fileBrowserStore.exportRegionNum < fileBrowserStore.regionOptionNum;
    }

    @computed private get isIndeterminateSelectAllAnnotations(): boolean {
        const fileBrowserStore = FileBrowserStore.Instance;
        return fileBrowserStore.exportAnnotationNum > 0 && fileBrowserStore.exportAnnotationNum < fileBrowserStore.annotationOptionNum;
    }

    @computed private get isIndeterminateSelectAllRegions(): boolean {
        const fileBrowserStore = FileBrowserStore.Instance;
        const regionNum = fileBrowserStore.exportRegionNum - fileBrowserStore.exportAnnotationNum;
        return regionNum > 0 && regionNum < fileBrowserStore.regionOptionNum - fileBrowserStore.annotationOptionNum;
    }

    constructor(props: any) {
        super(props);
        makeObservable(this);
    }

    private handleSelectAllChanged = (mode: SelectionMode) => {
        const fileBrowserStore = FileBrowserStore.Instance;
        switch (mode) {
            case SelectionMode.All:
                if (this.isSelectAll || this.isIndeterminateSelectAll) {
                    fileBrowserStore.clearExportRegionIndexes(mode);
                } else {
                    fileBrowserStore.resetExportRegionIndexes(mode);
                }
                break;
            case SelectionMode.Annotation:
                if (this.isSelectAllAnnotations || this.isIndeterminateSelectAllAnnotations) {
                    fileBrowserStore.clearExportRegionIndexes(mode);
                } else {
                    fileBrowserStore.resetExportRegionIndexes(mode);
                }
                break;
            case SelectionMode.Region:
                if (this.isSelectAllRegions || this.isIndeterminateSelectAllRegions) {
                    fileBrowserStore.clearExportRegionIndexes(mode);
                } else {
                    fileBrowserStore.resetExportRegionIndexes(mode);
                }
                break;
        }
    };

    private handleSelectRegionChanged = (regionIndex: number) => {
        const fileBrowserStore = FileBrowserStore.Instance;
        if (fileBrowserStore.exportRegionIndexes.includes(regionIndex)) {
            fileBrowserStore.deleteExportRegionIndex(regionIndex);
        } else {
            fileBrowserStore.addExportRegionIndex(regionIndex);
        }
    };

    private renderSelectStatus = () => {
        const fileBrowserStore = FileBrowserStore.Instance;
        let status;
        switch (fileBrowserStore.exportRegionNum) {
            case 0:
                status = "Please select elements to export.";
                break;
            case 1:
                status = `Selected 1 / ${fileBrowserStore.regionOptionNum} element.`;
                break;
            default:
                status = `Selected ${fileBrowserStore.exportRegionNum} / ${fileBrowserStore.regionOptionNum} elements.`;
        }
        return <pre className="select-status">{status}</pre>;
    };

    private renderSelectAll = (mode: SelectionMode) => {
        return (
            <>
                {mode === SelectionMode.All && <Checkbox key={0} checked={this.isSelectAll} indeterminate={this.isIndeterminateSelectAll} label="Select all" onChange={event => this.handleSelectAllChanged(SelectionMode.All)} />}
                {mode === SelectionMode.Region && (
                    <Checkbox key={1} checked={this.isSelectAllRegions} indeterminate={this.isIndeterminateSelectAllRegions} label="Select all regions" onChange={event => this.handleSelectAllChanged(SelectionMode.Region)} />
                )}
                {mode === SelectionMode.Annotation && (
                    <Checkbox key={2} checked={this.isSelectAllAnnotations} indeterminate={this.isIndeterminateSelectAllAnnotations} label="Select all annotations" onChange={event => this.handleSelectAllChanged(SelectionMode.Annotation)} />
                )}
            </>
        );
    };

    private renderRegionOptions = ({index, style}: {index: number; style: React.CSSProperties}) => {
        return (
            <Observer>
                {() => {
                    const fileBrowserStore = FileBrowserStore.Instance;
                    const item = fileBrowserStore.exportRegionOptions[index];

                    return (
                        <Checkbox
                            style={style}
                            checked={fileBrowserStore.exportRegionIndexes?.includes(item.value as number)}
                            labelElement={
                                <React.Fragment>
                                    {item.isCustomIcon ? <CustomIcon icon={item.icon as CustomIconName} /> : <Icon icon={item.icon as IconName} />}
                                    <span>&ensp;</span>
                                    {item.active ? <b>{item.label} (Active)</b> : item.label}
                                </React.Fragment>
                            }
                            onChange={() => this.handleSelectRegionChanged(item.value as number)}
                        />
                    );
                }}
            </Observer>
        );
    };

    private renderVirtualizedRegions = () => {
        const fileBrowserStore = FileBrowserStore.Instance;
        return (
            <div className="region-list">
                <AutoSizer>
                    {({height, width}) => (
                        <List itemSize={24} itemCount={fileBrowserStore.exportRegionOptions.length} width={width} height={height}>
                            {this.renderRegionOptions}
                        </List>
                    )}
                </AutoSizer>
            </div>
        );
    };

    render() {
        const optionNum = FileBrowserStore.Instance.regionOptionNum;
        const includesAnnotation = FileBrowserStore.Instance.includesAnnotation;
        const includesRegion = FileBrowserStore.Instance.includesRegion;
        const annotationNum = FileBrowserStore.Instance.annotationOptionNum;
        const regionNum = optionNum - annotationNum;

        return (
            <div className="select-region">
                {optionNum > 0 ? (
                    <React.Fragment>
                        {this.renderSelectStatus()}
                        {optionNum > 1 && this.renderSelectAll(SelectionMode.All)}
                        {includesRegion && includesAnnotation && regionNum > 1 && this.renderSelectAll(SelectionMode.Region)}
                        {includesAnnotation && includesRegion && annotationNum > 1 && this.renderSelectAll(SelectionMode.Annotation)}
                        {this.renderVirtualizedRegions()}
                    </React.Fragment>
                ) : (
                    <pre className="select-status">No regions/annotations in the active image.</pre>
                )}
            </div>
        );
    }
}
