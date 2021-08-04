import * as AST from "ast_wrapper";
import {action, observable, makeObservable, reaction, computed} from "mobx";
import {CatalogSystemType, Point2D} from "models";
import {AppStore, OverlayStore, NumberFormatType, ASTSettingsString, SystemType} from "stores";
import {AbstractCatalogProfileStore} from "models";
import {transformPoint} from "utilities";
// import {transformPoint} from "utilities";


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
            () =>  OverlayStore.Instance.global.defaultSystem,
            () => {
                this.coordsType = AbstractCatalogProfileStore.getCatalogSystem(OverlayStore.Instance.global.defaultSystem);
            }
        );
        
        reaction(   
            () => AppStore.Instance.activeFrame,
            () => {
                console.log(AppStore.Instance.activeFrame.center)
                const frame = AppStore.Instance.activeFrame;
                if(this.centerCoord.x === undefined && this.centerCoord.y === undefined && frame) {
                    const pointWCS = transformPoint(frame.wcsInfo, frame.center);
                    this.updateImageCenter(pointWCS);
                }
            }
        );

        reaction(
            () => AppStore.Instance.cursorFrozen,
            cursorFrozen => {
                const frame = AppStore.Instance.activeFrame;
                console.log(cursorFrozen, frame?.cursorInfo)
                if (cursorFrozen && frame?.cursorInfo?.posImageSpace) {
                    this.updateImageCenter(frame.cursorInfo.posWCS);
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

    @action updateImageCenter(center: any) {
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
                radiusIndeg = radiusIndeg * (1/360);
                break;
            default:
                break;
        }
        return radiusIndeg;
    }

    convertToDeg(point: Point2D) {
        const frame = AppStore.Instance.activeFrame;
        const overlay = OverlayStore.Instance;
        let p: {x: string, y: string} = {x: undefined, y: undefined};
        if (frame && overlay) {
            const precision = overlay.numbers.customPrecision ? overlay.numbers.precision : "*";
            const format = `${NumberFormatType.Degrees}.${precision}`; 
            // const pointWCS = transformPoint(frame.wcsInfo, point);
            // const normVals = AST.normalizeCoordinates(frame.wcsInfo, pointWCS.x, pointWCS.y);
            
            let astString = new ASTSettingsString();
            astString.add("Format(1)",format);
            astString.add("Format(2)",format);
            // console.log(OverlayStore.Instance.global.explicitSystem)
            astString.add("System", SystemType.ICRS);
            // const a = AST.getWCSValueFromFormattedString(frame.wcsInfo, point);
            p = AST.getFormattedCoordinates(frame.wcsInfo, point.x, point.y, astString.toString(), true);
        }
        return p;
    }
}