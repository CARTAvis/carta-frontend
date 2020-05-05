import {observer} from "mobx-react";
import * as React from "react";
import {FormGroup, HTMLSelect, IOptionProps, NumericInput} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import {AppStore} from "stores";
import {CatalogOverlayWidgetStore} from "stores/widgets";

@observer
export class CatalogOverlayFilterComponent extends React.Component<{widgetStore: CatalogOverlayWidgetStore}> {
    
    private handleRegionChanged = (changeEvent: React.ChangeEvent<HTMLSelectElement>) => {
        const frame = AppStore.Instance.activeFrame;
        if (frame) {
            this.props.widgetStore.setRegionId(frame.frameInfo.fileId, parseInt(changeEvent.target.value));
        }
    };

    private handleMaxRowChange = (value: number) => {
        // Todo user settings for preview data size
    };

    public render() {
        const frame = AppStore.Instance.activeFrame;
        const widgetStore = this.props.widgetStore;

        let enableRegionSelect = false;
        let regionId = 0;
        let profileRegionOptions: IOptionProps[];
        if (frame && frame.regionSet) {
            let fileId = frame.frameInfo.fileId;
            regionId = widgetStore.regionIdMap.get(fileId) || 0;
            profileRegionOptions = frame.regionSet.regions.filter(r => !r.isTemporary && (r.isClosedRegion || r.regionType === CARTA.RegionType.POINT)).map(r => {
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
                            value={50}
                            selectAllOnFocus={true}
                            buttonPosition={"none"}
                            max={widgetStore.catalogInfo.dataSize}
                            min={1}
                            stepSize={10}
                            disabled={widgetStore.loadingData}
                            allowNumericCharactersOnly={true}
                            onValueChange={(value: number) => this.handleMaxRowChange(value)}
                        />
                </FormGroup>
            </div>
        );
    }
}