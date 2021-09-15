import * as AST from "ast_wrapper";
import {action, observable, makeObservable, reaction, computed} from "mobx";
import {CatalogSystemType, Point2D} from "models";
import {AppStore, OverlayStore, NumberFormatType, ASTSettingsString, SystemType} from "stores";
import {clamp, getPixelValueFromWCS, transformPoint} from "utilities";

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
    public static readonly MAX_OBJECTS = 50000;
    public static readonly OBJECT_SIZE = 1000;

    @observable isQuerying: boolean;
    @observable catalogDB: CatalogDatabase;
    @observable searchRadius: number;
    @observable coordsType: CatalogSystemType;
    @observable coordsFormat: NumberFormatType;
    @observable centerPixelCoord: {x: string; y: string};
    @observable maxObject: number;
    @observable enablePointSelection: boolean;
    @observable radiusUnits: RadiusUnits;
    @observable objectName: string;
    @observable isObjectQuerying: boolean;

    constructor() {
        makeObservable(this);
        this.isQuerying = false;
        this.catalogDB = CatalogDatabase.SIMBAD;
        this.searchRadius = 1;
        this.coordsType = CatalogSystemType.ICRS;
        this.centerPixelCoord = {x: undefined, y: undefined};
        this.maxObject = CatalogOnlineQueryConfigStore.OBJECT_SIZE;
        this.enablePointSelection = false;
        this.radiusUnits = RadiusUnits.DEGREES;
        this.coordsFormat = NumberFormatType.Degrees;
        this.objectName = "";
        this.isObjectQuerying = false;

        reaction(
            () => AppStore.Instance.activeFrame,
            () => {
                this.resetSearchRadius();
            }
        );

        reaction(
            () => AppStore.Instance.cursorFrozen,
            cursorFrozen => {
                const frame = AppStore.Instance.activeFrame;
                if (cursorFrozen && frame?.cursorInfo?.posImageSpace) {
                    this.updateCenterPixelCoord(frame.cursorInfo.posImageSpace);
                }
            }
        );
    }

    static get Instance() {
        if (!CatalogOnlineQueryConfigStore.staticInstance) {
            CatalogOnlineQueryConfigStore.staticInstance = new CatalogOnlineQueryConfigStore();
        }
        return CatalogOnlineQueryConfigStore.staticInstance;
    }

    public setFrameCenter() {
        const frame = AppStore.Instance.activeFrame.spatialReference ?? AppStore.Instance.activeFrame;
        if(frame?.center) {
            this.updateCenterPixelCoord(frame.center);
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

    @action updateCenterPixelCoord(center: Point2D) {
        this.centerPixelCoord.x = center.x.toString();
        this.centerPixelCoord.y = center.y.toString();
    }

    @action setMaxObjects(size: number) {
        this.maxObject = size;
    }

    @action resetMaxObjects() {
        this.maxObject = CatalogOnlineQueryConfigStore.OBJECT_SIZE;
    }

    @action setPointSelection() {
        this.enablePointSelection = !this.enablePointSelection;
    }

    @action setRadiusUnits(units: RadiusUnits) {
        switch (units) {
            case RadiusUnits.ARCMINUTES:
                this.setSearchRadius(this.radiusAsArcm);
                break;
            case RadiusUnits.ARCSECONDS:
                this.setSearchRadius(this.radiusAsArcs);
                break;
            default:
                this.setSearchRadius(this.radiusAsDeg);
                break;
        }
        this.radiusUnits = units;
    }

    @action setCoordsFormat(format: NumberFormatType) {
        this.coordsFormat = format;
    }

    @action setObjectName(object: string) {
        this.objectName = object;
    }

    @action setObjectQueryStatus(isQuerying: boolean) {
        this.isObjectQuerying = isQuerying;
    }

    @computed get radiusAsDeg(): number {
        let radius = this.searchRadius;
        switch (this.radiusUnits) {
            case RadiusUnits.ARCMINUTES:
                radius = radius * (1 / 60);
                break;
            case RadiusUnits.ARCSECONDS:
                radius = radius * (1 / 3600);
                break;
            default:
                break;
        }
        return Number(radius.toPrecision(6));
    }

    @computed get radiusAsArcm(): number {
        let radius = this.searchRadius;
        switch (this.radiusUnits) {
            case RadiusUnits.DEGREES:
                radius = radius * 60;
                break;
            case RadiusUnits.ARCSECONDS:
                radius = radius * (1 / 60);
                break;
            default:
                break;
        }
        return Number(radius.toPrecision(6));
    }

    @computed get radiusAsArcs(): number {
        let radius = this.searchRadius;
        switch (this.radiusUnits) {
            case RadiusUnits.ARCMINUTES:
                radius = radius * 60;
                break;
            case RadiusUnits.DEGREES:
                radius = radius * 3600;
                break;
            default:
                break;
        }
        return Number(radius.toPrecision(6));
    }

    // SIMBAD radius range 0 - 90 degrees
    @computed get maxRadius(): number {
        switch (this.radiusUnits) {
            case RadiusUnits.ARCMINUTES:
                return 90 * 60;
            case RadiusUnits.ARCSECONDS:
                return 90 * 3600;
            default:
                return 90;
        }
    }

    @computed get disableObjectSearch(): boolean {
        return this.objectName === "";
    }

    @computed get searchRadiusInDegree(): number {
        const activeFrame = AppStore.Instance.activeFrame;
        if (activeFrame) {
            const requiredFrameView = activeFrame.requiredFrameView;
            const max = this.convertToDeg({x: requiredFrameView.xMax, y: requiredFrameView.yMax});
            const min = this.convertToDeg({x: requiredFrameView.xMin, y: requiredFrameView.yMin});
            const x = Number(max.x) - Number(min.x);
            const y = Number(max.y) - Number(min.y);
            const diagonal = Math.sqrt(x * x + y * y);
            if (isNaN(diagonal)) {
                return 90;
            }
            return clamp(diagonal / 2, 0, 90);
        }
        return 90;
    }

    @computed get centerPixelCoordAsPoint2D(): Point2D {
        return {
            x: Number(this.centerPixelCoord.x),
            y: Number(this.centerPixelCoord.y)
        }
    }

    @action resetSearchRadius() {
        let radius = this.searchRadiusInDegree;
        switch (this.radiusUnits) {
            case RadiusUnits.ARCMINUTES:
                radius = radius * 60;
                break;
            case RadiusUnits.ARCSECONDS:
                radius = radius * 3600;
                break;
            default:
                break;
        }
        this.setSearchRadius(radius);
        this.setFrameCenter();
    }

    convertToDeg(pixelCoords: Point2D): {x: string; y: string} {
        const frame = AppStore.Instance.activeFrame;
        const overlay = OverlayStore.Instance;
        let p: {x: string; y: string} = {x: undefined, y: undefined};
        if (frame && overlay) {
            const precision = overlay.numbers.customPrecision ? overlay.numbers.precision : "*";
            const format = `${NumberFormatType.Degrees}.${precision}`;
            const wcsCopy = AST.copy(frame.wcsInfo);
            let astString = new ASTSettingsString();
            AST.set(wcsCopy, `System=${SystemType.ICRS}`);
            astString.add("Format(1)", format);
            astString.add("Format(2)", format);
            astString.add("System", SystemType.ICRS);
            const pointWCS = transformPoint(wcsCopy, pixelCoords);
            const normVals = AST.normalizeCoordinates(wcsCopy, pointWCS.x, pointWCS.y);
            p = AST.getFormattedCoordinates(wcsCopy, normVals.x, normVals.y, astString.toString(), true);
            AST.deleteObject(wcsCopy);
        }
        return p;
    }

    convertToPixel(Coords: Point2D): Point2D {
        const frame = AppStore.Instance.activeFrame;
        const overlay = OverlayStore.Instance;
        let p: {x: number; y: number} = {x: undefined, y: undefined};
        if (frame && overlay) {
            const precision = overlay.numbers.customPrecision ? overlay.numbers.precision : "*";
            const format = `${NumberFormatType.Degrees}.${precision}`;
            const wcsCopy = AST.copy(frame.wcsInfo);
            let astString = new ASTSettingsString();
            AST.set(wcsCopy, `System=${SystemType.ICRS}`);
            astString.add("Format(1)", format);
            astString.add("Format(2)", format);
            astString.add("System", SystemType.ICRS);
            p = getPixelValueFromWCS(wcsCopy, {x: Coords.x.toString(), y: Coords.y.toString()});
            AST.deleteObject(wcsCopy);
        }
        return p;
    }
}
