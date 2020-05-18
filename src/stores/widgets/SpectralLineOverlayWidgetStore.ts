import {CARTA} from "carta-protobuf";
import {AppStore} from "stores";
import {RegionWidgetStore, RegionsType} from "./RegionWidgetStore";

export class SpectralLineOverlayWidgetStore extends RegionWidgetStore {
    constructor() {
        super(RegionsType.CLOSED);
    }
}