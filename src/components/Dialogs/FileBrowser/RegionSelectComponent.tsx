import * as React from "react";
import {observer} from "mobx-react";
import {autorun, computed, makeObservable} from "mobx";
import {Checkbox, Icon, IconName} from "@blueprintjs/core";
import {FileBrowserStore} from "stores";
import {CustomIcon, CustomIconName} from "icons/CustomIcons";
import "./RegionSelectComponent.scss";

@observer
export class RegionSelectComponent extends React.Component {
    @computed private get isSelectAll(): boolean {
        const fileBrowserStore = FileBrowserStore.Instance;
        return fileBrowserStore.exportRegionNum === fileBrowserStore.regionOptionNum;
    }

    @computed private get isIndeterminateSelectAll(): boolean {
        const fileBrowserStore = FileBrowserStore.Instance;
        return fileBrowserStore.exportRegionNum > 0 && fileBrowserStore.exportRegionNum < fileBrowserStore.regionOptionNum;
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

    private renderSelectStatus = () => {
        const fileBrowserStore = FileBrowserStore.Instance;
        let status;
        switch (fileBrowserStore.exportRegionNum) {
            case 0:
                status = "Please select regions to export.";
                break;
            case 1:
                status = `Selected 1 / ${fileBrowserStore.regionOptionNum} region.`;
                break;
            default:
                status = `Selected ${fileBrowserStore.exportRegionNum} / ${fileBrowserStore.regionOptionNum} regions.`;
        }
        return <pre className="select-status">{status}</pre>;
    };

    private renderSelectAll = () => {
        return <Checkbox key={0} checked={this.isSelectAll} indeterminate={this.isIndeterminateSelectAll} label="Select all" onChange={this.handleSelectAllChanged} />;
    };

    private renderRegionOptions = () => {
        const fileBrowserStore = FileBrowserStore.Instance;
        return fileBrowserStore.exportRegionOptions.map(item => (
            <Checkbox
                key={item.value}
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
        ));
    };

    render() {
        const optionNum = FileBrowserStore.Instance.regionOptionNum;
        return (
            <div className="select-region">
                {optionNum > 0 ? (
                    <React.Fragment>
                        {this.renderSelectStatus()}
                        {optionNum > 1 ? this.renderSelectAll() : null}
                        {this.renderRegionOptions()}
                    </React.Fragment>
                ) : (
                    <pre className="select-status">No regions in the active image.</pre>
                )}
            </div>
        );
    }
}
