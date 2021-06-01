import * as React from "react";
import {observer} from "mobx-react";
import {Checkbox, FormGroup} from "@blueprintjs/core";
import { FileBrowserStore } from "stores";

@observer
export class RegionSelectComponent extends React.Component {

    private handleRegionMenuSelected = (regionIndex: number) => {
        const fileBrowserStore = FileBrowserStore.Instance;
        if (regionIndex === -1) { // selected export all regions
            fileBrowserStore.setIsExportAllRegions(true);
            fileBrowserStore.clearExportRegionIndexes();
        } else {
            if (fileBrowserStore.exportRegionIndexes.includes(regionIndex)) {
                if (fileBrowserStore.exportRegionIndexes.length === 1) {
                    return;
                } else {
                    fileBrowserStore.deleteExportRegionIndex(regionIndex);
                }
            } else {
                fileBrowserStore.addExportRegionIndex(regionIndex);
                fileBrowserStore.setIsExportAllRegions(false);
            }
        }
    };
    
    render() {
        const fileBrowserStore = FileBrowserStore.Instance;
        return (
            <div>
                <FormGroup inline={false} label="Select export regions">
                    <Checkbox
                        label="Select all"
                        checked={fileBrowserStore.isExportAllRegions}
                        //indeterminate={preference.isSelectingIndeterminateLogEvents}
                        onChange={() => this.handleRegionMenuSelected(-1)}
                    />
                    {fileBrowserStore.exportRegionOptions.map((item) =>
                        <Checkbox
                            key={item.value}
                            checked={fileBrowserStore.exportRegionIndexes?.includes(item.value as number)}
                            label={item.label}
                            onChange={() => this.handleRegionMenuSelected(item.value as number)}
                        />
                    )}
                </FormGroup>
            </div>
        );
    }
}