import * as AST from "ast_wrapper";
import {action, observable, makeObservable, reaction, computed} from "mobx";
import {CatalogSystemType, Point2D} from "models";
import {AppStore, OverlayStore, NumberFormatType, ASTSettingsString, SystemType} from "stores";
import {transformPoint} from "utilities";

export enum CatalogDatabase {
    SIMBAD = "SIMBAD"
}

export enum RadiusUnits {
    DEGREES = "deg",
    ARCMINUTES = "arcmin",
    ARCSECONDS = "arcsec"
}

export class CatalogOnlineQueryConfigStore {
    private static staticInstance: CatalogOnlineQueryConfigStore;
    public static readonly MIN_OBJECTS = 1;
    public static readonly MAX_OBJECTS = 1000;

    @observable isQuerying: boolean;
    @observable catalogDB: CatalogDatabase;
    @observable searchRadius: number;
    @observable coordsType: CatalogSystemType;
    @observable coordsFormat: NumberFormatType
    @observable centerCoord: {x: string, y: string};
    @observable maxObject: number;
    @observable enablePointSelection: boolean
    @observable radiusUnits: RadiusUnits;
    @observable coordType: NumberFormatType;

    constructor() {
        makeObservable(this);
        this.isQuerying = false;
        this.catalogDB = CatalogDatabase.SIMBAD;
        this.searchRadius = 1;
        this.coordsType = CatalogSystemType.ICRS;
        this.centerCoord = {x: undefined, y: undefined};
        this.maxObject = 1000;
        this.enablePointSelection = false;
        this.radiusUnits = RadiusUnits.DEGREES;
        this.coordsFormat = NumberFormatType.Degrees;
        
        reaction(   
            () => AppStore.Instance.activeFrame,
            () => {
                this.setCenter();
            }
        );

        reaction(
            () => AppStore.Instance.cursorFrozen,
            cursorFrozen => {
                const frame = AppStore.Instance.activeFrame;
                if (cursorFrozen && frame?.cursorInfo?.posImageSpace) {
                    this.updateCenterCoord(frame.cursorInfo.posImageSpace);
                }
            }
        )

        reaction(
            () =>  OverlayStore.Instance.global.explicitSystem,
            syetem => {
                const frame = AppStore.Instance.activeFrame;
                console.log(frame?.cursorInfo?.posImageSpace.x, frame.center.x)
                if (frame?.cursorInfo?.posImageSpace) {
                    this.updateCenterCoord(frame.cursorInfo.posImageSpace);
                } else if (frame?.center) {
                    this.updateCenterCoord(frame.center);
                } 
            }
        )
    }

    static get Instance() {
        if (!CatalogOnlineQueryConfigStore.staticInstance) {
            CatalogOnlineQueryConfigStore.staticInstance = new CatalogOnlineQueryConfigStore();
        }
        return CatalogOnlineQueryConfigStore.staticInstance;
    }

    public setCenter() {
        const frame = AppStore.Instance.activeFrame;
        if (frame?.center) {
            this.updateCenterCoord(frame.center);
        }
    }

    @action setQueryStatus(isQuerying: boolean) {
        this.isQuerying = isQuerying;
    }

    @action setCatalogDB(db: CatalogDatabase) {
        this.catalogDB = db;
    }

    @action setSearchRadius(radius: number) {
        this.searchRadius = radius;
    }

    @action setCoordsType(type: CatalogSystemType) {
        this.coordsType = type;
    }

    @action setCenterCoord(val: string, type: "X" | "Y") {
        const coords = this.centerCoord;
        if (type === "X") {
            coords.x = val;   
        } else {
            coords.y = val; 
        }
        this.centerCoord = coords;
    }

    @action updateCenterCoord(center: Point2D) {
        const coord = this.convertToDeg(center);
        this.setCenterCoord(coord.x.toString(), "X");
        this.setCenterCoord(coord.y.toString(), "Y");
    }

    @action setMaxObjects(size: number) {
        this.maxObject = size;
    }

    @action resetMaxObjects() {
        this.maxObject = CatalogOnlineQueryConfigStore.MAX_OBJECTS;
    }

    @action setPointSelection() {
        this.enablePointSelection = !this.enablePointSelection;
    }

    @action setRadiusUnits(units: RadiusUnits) {
        this.radiusUnits = units;
    }

    @action setCoordsFormat(format: NumberFormatType) {
        this.coordsFormat = format;
    }

    @computed get radiusInDeg(): number {
        let radiusIndeg = this.searchRadius;
        switch (this.radiusUnits) {
            case RadiusUnits.ARCMINUTES:
                radiusIndeg = radiusIndeg * (1/60);
                break;
            case RadiusUnits.ARCSECONDS:
                radiusIndeg = radiusIndeg * (1/3600);
                break;
            default:
                break;
        }
        return radiusIndeg;
    }

    convertToDeg(pixelCoords: Point2D) {
        const frame = AppStore.Instance.activeFrame;
        const overlay = OverlayStore.Instance;
        let p: {x: string, y: string} = {x: undefined, y: undefined};
        if (frame && overlay) {
            const precision = overlay.numbers.customPrecision ? overlay.numbers.precision : "*";
            const format = `${NumberFormatType.Degrees}.${precision}`;
            const wcsCopy = AST.copy(frame.wcsInfo);
            let astString = new ASTSettingsString();
            AST.set(wcsCopy, `System=${SystemType.ICRS}`);
            astString.add("Format(1)",format);
            astString.add("Format(2)",format);
            astString.add("System", SystemType.ICRS);
            const pointWCS = transformPoint(wcsCopy, pixelCoords);
            const normVals = AST.normalizeCoordinates(wcsCopy, pointWCS.x, pointWCS.y);
            p = AST.getFormattedCoordinates(wcsCopy, normVals.x, normVals.y, astString.toString(), true);
            AST.deleteObject(wcsCopy);
        }
        return p;
    }
}