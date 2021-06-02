import * as React from "react";
import {observer} from "mobx-react";
import {autorun, computed, makeObservable} from "mobx";
import {Checkbox, FormGroup, Icon} from "@blueprintjs/core";
import {FileBrowserStore} from "stores";
import "./RegionSelectComponent.scss";

@observer
export class RegionSelectComponent extends React.Component {

    @computed private get isSelectAll(): boolean {
        const fileBrowserStore = FileBrowserStore.Instance;
        return fileBrowserStore.exportRegionIndexes?.length === fileBrowserStore.exportRegionOptions?.length;
    }

    @computed private get isIndeterminateSelectAll(): boolean {
        const fileBrowserStore = FileBrowserStore.Instance;
        const exportRegionNumber = fileBrowserStore.exportRegionIndexes?.length;
        return exportRegionNumber > 0 && exportRegionNumber < fileBrowserStore.exportRegionOptions?.length;
    }

    constructor(props: any) {
        super(props);
        makeObservable(this);

        autorun(() => {
            FileBrowserStore.Instance.resetExportRegionIndexes();
        });
    }

    private handleSelectAllChanged = () => {
        const fileBrowserStore = FileBrowserStore.Instance;
        if (this.isSelectAll || this.isIndeterminateSelectAll) {
            fileBrowserStore.clearExportRegionIndexes();
        } else {
            fileBrowserStore.resetExportRegionIndexes();
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
    
    render() {
        const fileBrowserStore = FileBrowserStore.Instance;
        return (
            <div className="select-region">
            {fileBrowserStore.exportRegionOptions?.length > 0 ? (
            <FormGroup label="Select export regions">
                {fileBrowserStore.exportRegionOptions?.length > 1 ? (
                <Checkbox
                    key={0}
                    checked={this.isSelectAll}
                    indeterminate={this.isIndeterminateSelectAll}
                    label="Select all"
                    onChange={this.handleSelectAllChanged}
                />
                ) : null}
                {fileBrowserStore.exportRegionOptions.map(item =>
                <Checkbox
                    key={item.value}
                    checked={fileBrowserStore.exportRegionIndexes?.includes(item.value as number)}
                    labelElement={
                        <React.Fragment>
                            <Icon icon={item.icon} style={{opacity: 0.5}}/>
                            <span>&ensp;</span>{item.active ? <b>{item.label} (Active)</b> : item.label}
                        </React.Fragment>
                    }
                    onChange={() => this.handleSelectRegionChanged(item.value as number)}
                />
                )}
            </FormGroup>
            ) : (
            <span>No regions in the active image.</span>
            )}
            </div>
        );
    }
}