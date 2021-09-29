import {action, observable, makeObservable, computed} from "mobx";
import {CARTA} from "carta-protobuf";
import {IOptionProps} from "@blueprintjs/core";

export class PVGeneratorWidgetStore {
    @observable fileId: number;
    @observable regionId: number;
    @observable average: number;

    @computed get regionOptions(): IOptionProps[] {
        let regionOptions: IOptionProps[];
        if (this.frame) {
            if (this.frame?.regionSet) {
                const validRegionOptions = this.frame.regionSet.regions
                    ?.filter(r => !r.isTemporary && r.regionType === CARTA.RegionType.LINE)
                    ?.map(region => {
                        return {value: region?.regionId, label: region?.nameString};
                    });
                if (validRegionOptions) {
                    regionOptions = validRegionOptions;
                }
            }
        }
        return regionOptions;
    }

    @action setFileId = (val: number) => {
        this.fileId = val;
    };

    @action setRegionId = (val: number) => {
        this.regionId = val;
    };

    @action setAverage = (val: number) => {
        this.average = val;
    };

    constructor() {
        makeObservable(this);
    }
}
