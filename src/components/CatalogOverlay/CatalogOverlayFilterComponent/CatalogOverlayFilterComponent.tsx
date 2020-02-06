import {observer} from "mobx-react";
import * as React from "react";
import {FormGroup, HTMLSelect, IOptionProps, NumericInput} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import {AppStore} from "stores";
import {CatalogOverlayWidgetStore} from "stores/widgets";

@observer
export class CatalogOverlayFilterComponent extends React.Component<{widgetStore: CatalogOverlayWidgetStore, appStore: AppStore}> {
    
    private handleRegionChanged = (changeEvent: React.ChangeEvent<HTMLSelectElement>) => {
        if (this.props.appStore.activeFrame) {
            this.props.widgetStore.setRegionId(this.props.appStore.activeFrame.frameInfo.fileId, parseInt(changeEvent.target.value));
        }
    };

    private handleMaxRowChange = (value: number) => {
        if (isNaN(value) || value < 0) {
            // return all data
            this.props.widgetStore.setMaxRow(-1);
        } else {
            this.props.widgetStore.setMaxRow(value);
        }
    };

    public render() {
        const appStore = this.props.appStore;
        const widgetStore = this.props.widgetStore;

        let enableRegionSelect = false;
        let regionId = 0;
        let profileRegionOptions: IOptionProps[];
        if (appStore.activeFrame && appStore.activeFrame.regionSet) {
            let fileId = appStore.activeFrame.frameInfo.fileId;
            regionId = widgetStore.regionIdMap.get(fileId) || 0;
            profileRegionOptions = appStore.activeFrame.regionSet.regions.filter(r => !r.isTemporary && (r.isClosedRegion || r.regionType === CARTA.RegionType.POINT)).map(r => {
                return {
                    value: r.regionId,
                    label: r.nameString
                };
            });

            enableRegionSelect = profileRegionOptions.length > 1;
        }

        return (
            <div className="catalog-overlay-filter">
                <FormGroup label={"Region"} inline={true} disabled={!enableRegionSelect}>
                    <HTMLSelect value={regionId} options={profileRegionOptions} onChange={this.handleRegionChanged} disabled={!enableRegionSelect}/>
                </FormGroup>
                <FormGroup label={"Max Row"} inline={true}>
                        <NumericInput
                            value={widgetStore.maxRow}
                            selectAllOnFocus={true}
                            buttonPosition={"none"}
                            max={widgetStore.catalogInfo.dataSize}
                            min={-1}
                            allowNumericCharactersOnly={true}
                            onValueChange={(value: number) => this.handleMaxRowChange(value)}
                        />
                </FormGroup>
            </div>
        );
    }
}