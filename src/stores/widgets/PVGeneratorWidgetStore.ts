import {action, observable, makeObservable, computed} from "mobx";
import {CARTA} from "carta-protobuf";
import {AppStore} from "stores";
import {IOptionProps} from "@blueprintjs/core";
import {RegionWidgetStore, RegionsType, RegionId} from "./RegionWidgetStore";

export class PVGeneratorWidgetStore extends RegionWidgetStore {
    @observable average: number;

    @computed get regionOptions(): IOptionProps[] {
        const appStore = AppStore.Instance;
        let regionOptions: IOptionProps[] = [{value: RegionId.ACTIVE, label: "Active"}];
        if (appStore.frames) {
            const selectedFrame = appStore.getFrame(this.fileId);
            if (selectedFrame?.regionSet) {
                const validRegionOptions = selectedFrame.regionSet.regions
                    ?.filter(r => !r.isTemporary && r.regionType === CARTA.RegionType.LINE)
                    ?.map(region => {
                        return {value: region?.regionId, label: region?.nameString};
                    });
                if (validRegionOptions) {
                    regionOptions = regionOptions.concat(validRegionOptions);
                }
            }
        }
        return regionOptions;
    }

    @action setAverage = (val: number) => {
        this.average = val;
    };

    constructor() {
        super(RegionsType.LINE);
        makeObservable(this);
        this.average = 3;
    }
}
