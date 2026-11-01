import {type CARTA} from "carta-protobuf";
import {action, computed, flow, makeObservable, observable} from "mobx";

import {SIA_BANDS, type SiaBand, SiaDataProductType, SystemType} from "enums";
import {type Point2D} from "models";
import {ApiService, BackendService, CatalogApiService} from "services";
import {AppStore, CatalogOnlineQueryConfigStore} from "stores";
import {type RegionStore} from "stores/Frame";

/** An SIA 2.0 service offered by the backend. */
export interface SiaService {
    /** Human-readable service name. */
    name: string;
    /** The service query endpoint. */
    queryUrl: string;
}

/** A column of the SIA result table, keyed by its record field. */
export interface SiaColumn {
    key: string;
    name: string;
    width: number;
}

/** Management of SIA 2.0 image queries, performed by the backend. */
export class SiaQueryStore {
    private static staticInstance: SiaQueryStore;

    /** The search radius used until the user sets one, in degrees. */
    public static readonly DEFAULT_RADIUS = 0.1;

    /** Every result column, in display order. Empty ones are omitted by {@link columns}. */
    private static readonly AllColumns: SiaColumn[] = [
        {key: "targetName", name: "Target", width: 120},
        {key: "obsTitle", name: "Title", width: 200},
        {key: "proposalTitle", name: "Proposal", width: 200},
        {key: "obsId", name: "Obs ID", width: 160},
        {key: "collection", name: "Collection", width: 120},
        {key: "facility", name: "Facility", width: 100},
        {key: "instrument", name: "Instrument", width: 100},
        {key: "dataproductType", name: "Type", width: 70},
        {key: "dataproductSubtype", name: "Subtype", width: 90},
        {key: "bandpass", name: "Band", width: 80},
        {key: "calibLevel", name: "Calib", width: 60},
        {key: "ra", name: "RA (deg)", width: 90},
        {key: "dec", name: "Dec (deg)", width: 90},
        {key: "fov", name: "FoV (deg)", width: 90},
        {key: "accessEstsize", name: "Size", width: 80},
        {key: "accessFormat", name: "Access", width: 80}
    ];

    private static readonly NumericColumns = new Set(["calibLevel", "ra", "dec", "fov", "accessEstsize"]);

    /** Decimal places requested when converting image coordinates to degrees; 1e-6 deg is ~4 mas. */
    private static readonly DegreePrecision = "6";

    /** The MJD of the unix epoch, 1970-01-01. */
    private static readonly MjdAtUnixEpoch = 40587;

    private static readonly MillisecondsPerDay = 86400000;

    /** Decimal places kept on a converted MJD; matches the step size of the numeric inputs. */

    /**
     * Used only when no CARTA backend served the runtime config, as when the frontend runs from
     * the development server. An operator disabling SIA yields an empty list, not a missing one.
     */
    private static readonly FallbackServices: SiaService[] = [
        {name: "GAVO Data Center (Heidelberg)", queryUrl: "https://dc.g-vo.org/__system__/siap2/sitewide/siap2.xml"},
        {name: "CADC", queryUrl: "https://ws.cadc-ccda.hia-iha.nrc-cnrc.gc.ca/sia/v2query"},
        {name: "IRSA (IPAC)", queryUrl: "https://irsa.ipac.caltech.edu/SIA"}
    ];

    /** The SIA services configured on the backend; empty when an operator has disabled SIA queries. */
    get services(): SiaService[] {
        return ApiService.runtimeConfig.siaServices ?? SiaQueryStore.FallbackServices;
    }

    /** The SIA service query endpoint to be used. */
    @observable serviceUrl = "";
    /** The object name to resolve to center coordinates. */
    @observable object = "";
    /** The ICRS center coordinates of the search circle (degrees). */
    @observable center: Point2D = {x: NaN, y: NaN};
    /** The radius of the search circle (degrees). */
    @observable radius = SiaQueryStore.DEFAULT_RADIUS;
    /** The minimum wavelength (metres). */
    @observable bandMin = NaN;
    /** The maximum wavelength (metres). */
    @observable bandMax = NaN;
    /** The start time (MJD). */
    @observable timeMin = NaN;
    /** The end time (MJD). */
    @observable timeMax = NaN;
    /** The polarization states to match. */
    @observable pol: string[] = [];
    /** The data collection filter. */
    @observable collection = "";
    /** The facility (telescope) filter. */
    @observable facility = "";
    /** The instrument filter. */
    @observable instrument = "";
    /** The target name filter. */
    @observable target = "";
    /** The data product type filter. */
    @observable dpType = SiaDataProductType.Any;
    /** The calibration levels to match. */
    @observable calibLevels: number[] = [];
    /** The maximum number of records to request. */
    @observable maxrec = 100;

    /** Whether a query is in progress. */
    @observable isQuerying = false;
    /** Whether an object name resolution is in progress. */
    @observable isResolvingObject = false;
    /** Whether the selected record is being loaded. */
    @observable isLoadingFile = false;
    /** The error message of the last failed query or load. */
    @observable queryError = "";
    /** The records returned by the last query, in service order. */
    @observable.shallow records: CARTA.SiaRecord.$Properties[] = [];
    /** The cached index of the selected record, or -1 when nothing is selected. */
    @observable selectedRecordId = -1;
    /** Free-text filter over the displayed columns of the returned records. */
    @observable resultFilter = "";
    /** The record field the results are sorted by, or "" for service order. */
    @observable sortColumn = "";
    /** Whether the sorted results are in ascending order. */
    @observable isSortAscending = true;

    public static get Instance() {
        if (!SiaQueryStore.staticInstance) {
            SiaQueryStore.staticInstance = new SiaQueryStore();
        }
        return SiaQueryStore.staticInstance;
    }

    constructor() {
        makeObservable(this);
        this.serviceUrl = this.services[0]?.queryUrl ?? "";
    }

    /** Whether the record's access format denotes a DataLink document rather than a direct file. */
    public static isDataLinkRecord(record: CARTA.SiaRecord.$Properties): boolean {
        return !!record.accessFormat?.toLowerCase().includes("datalink");
    }

    /**
     * Formats a record field for display. An empty string means the record has no value for it.
     * @param record - The record to read.
     * @param key - The record field.
     */
    public static formatValue(record: CARTA.SiaRecord.$Properties | undefined, key: string): string {
        if (!record) {
            return "";
        }
        switch (key) {
            case "ra":
            case "dec":
            case "fov": {
                const value = record[key];
                return value === null || value === undefined || !isFinite(value) ? "" : value.toFixed(4);
            }
            case "calibLevel": {
                const level = Number(record.calibLevel ?? -1);
                return isFinite(level) && level >= 0 ? String(level) : "";
            }
            case "accessEstsize": {
                // A DataLink record points at a document, not at the data, so its size says nothing about the download
                const kbytes = Number(record.accessEstsize ?? -1);
                if (SiaQueryStore.isDataLinkRecord(record) || !isFinite(kbytes) || kbytes <= 0) {
                    return "";
                }
                return kbytes >= 1e6 ? `${(kbytes / 1e6).toFixed(1)} GB` : kbytes >= 1e3 ? `${(kbytes / 1e3).toFixed(1)} MB` : `${kbytes} kB`;
            }
            case "accessFormat": {
                const format = record.accessFormat;
                if (!format) {
                    return "";
                }
                return SiaQueryStore.isDataLinkRecord(record) ? "DataLink" : format.toLowerCase().includes("fits") ? "FITS" : format;
            }
            default:
                return record[key] === null || record[key] === undefined ? "" : String(record[key]);
        }
    }

    /**
     * The MJD range spanning the given number of days up to a moment in time.
     * @param days - The length of the range.
     * @param nowMillis - The end of the range, as a unix epoch time in milliseconds.
     */
    public static relativeMjdRange(days: number, nowMillis: number): {min: number; max: number} {
        // Whole days, so the range covers every observation of its first and last day
        const end = nowMillis / SiaQueryStore.MillisecondsPerDay + SiaQueryStore.MjdAtUnixEpoch;
        return {min: Math.floor(end - days), max: Math.ceil(end)};
    }

    private static sortValue(record: CARTA.SiaRecord.$Properties, key: string): number | string {
        const formatted = SiaQueryStore.formatValue(record, key);
        if (SiaQueryStore.NumericColumns.has(key)) {
            return formatted ? Number(record[key]) : -Infinity;
        }
        return formatted.toLowerCase();
    }

    /** Whether the current state is valid for an SIA query. */
    @computed get isValid(): boolean {
        return this.serviceUrl.length > 0 && isFinite(this.center.x) && isFinite(this.center.y) && this.radius > 0;
    }

    /** The SIA query request built from the set filters. */
    @computed get queryRequest(): CARTA.SiaQueryRequest.$Properties {
        const filters: CARTA.SiaFilter.$Properties[] = [];
        const addRange = (key: string, min: number, max: number) => {
            if (isFinite(min) || isFinite(max)) {
                filters.push({key, value: `${isFinite(min) ? min : "-Inf"} ${isFinite(max) ? max : "+Inf"}`});
            }
        };
        addRange("BAND", this.bandMin, this.bandMax);
        addRange("TIME", this.timeMin, this.timeMax);
        this.pol.forEach(pol => filters.push({key: "POL", value: pol}));
        if (this.collection) {
            filters.push({key: "COLLECTION", value: this.collection});
        }
        if (this.facility) {
            filters.push({key: "FACILITY", value: this.facility});
        }
        if (this.instrument) {
            filters.push({key: "INSTRUMENT", value: this.instrument});
        }
        if (this.target) {
            filters.push({key: "TARGET", value: this.target});
        }
        if (this.dpType) {
            filters.push({key: "DPTYPE", value: this.dpType});
        }
        this.calibLevels.forEach(level => filters.push({key: "CALIB", value: String(level)}));
        if (isFinite(this.maxrec) && this.maxrec > 0) {
            filters.push({key: "MAXREC", value: String(this.maxrec)});
        }

        return {
            serviceUrl: this.serviceUrl,
            ra: this.center.x,
            dec: this.center.y,
            radius: this.radius,
            filters
        };
    }

    /** The named band the wavelength range covers exactly, or undefined once either end is edited. */
    @computed get selectedBand(): SiaBand | undefined {
        const matches = (bound: number, value: number) => (isNaN(bound) && isNaN(value)) || bound === value;
        return SIA_BANDS.find(band => matches(band.min, this.bandMin) && matches(band.max, this.bandMax));
    }

    /** The result columns which have a value in at least one record. */
    @computed get columns(): SiaColumn[] {
        return SiaQueryStore.AllColumns.filter(column => this.records.some(record => SiaQueryStore.formatValue(record, column.key) !== ""));
    }

    /** The records matching the free-text filter. */
    @computed get filteredRecords(): CARTA.SiaRecord.$Properties[] {
        const filter = this.resultFilter.trim().toLowerCase();
        if (!filter) {
            return this.records;
        }
        return this.records.filter(record => this.columns.some(column => SiaQueryStore.formatValue(record, column.key).toLowerCase().includes(filter)));
    }

    /** The records in the order they are displayed. */
    @computed get displayedRecords(): CARTA.SiaRecord.$Properties[] {
        if (!this.sortColumn) {
            return this.filteredRecords;
        }
        const direction = this.isSortAscending ? 1 : -1;
        return [...this.filteredRecords].sort((a, b) => {
            const aValue = SiaQueryStore.sortValue(a, this.sortColumn);
            const bValue = SiaQueryStore.sortValue(b, this.sortColumn);
            return direction * (aValue < bValue ? -1 : aValue > bValue ? 1 : 0);
        });
    }

    /** The selected record, if any; a record hidden by the filter counts as deselected. */
    @computed get selectedRecord(): CARTA.SiaRecord.$Properties | undefined {
        return this.selectedRecordId < 0 ? undefined : this.displayedRecords.find(record => record.index === this.selectedRecordId);
    }

    /** The displayed row of the selected record, or -1 when nothing is selected. */
    @computed get selectedRow(): number {
        return this.selectedRecordId < 0 ? -1 : this.displayedRecords.findIndex(record => record.index === this.selectedRecordId);
    }

    /** The frame the search position is taken from. */
    @computed private get positionFrame() {
        return CatalogOnlineQueryConfigStore.Instance.activeFrame;
    }

    /** Whether the search circle can be set from the current view. */
    @computed get canSetFromView(): boolean {
        return !!this.positionFrame?.isValidWcs;
    }

    /** The result count, and how many of them the filter is showing. */
    @computed get resultInfo(): string {
        if (this.isQuerying) {
            return "Querying...";
        }
        if (!this.records.length) {
            return "";
        }
        const found = `Found ${this.records.length} dataset(s)`;
        return this.displayedRecords.length === this.records.length ? found : `${found}, showing ${this.displayedRecords.length}`;
    }

    /** Explains what the button does, or why it cannot be used. */
    @computed get setFromViewTooltip(): string {
        if (!this.positionFrame) {
            return "Load an image to use its view";
        }
        if (!this.positionFrame.isValidWcs) {
            return "The active image has no valid WCS";
        }
        return "Set center and radius to the current image view";
    }

    /** Explains what the button does, or why it cannot be used. */
    @computed get setFromRegionTooltip(): string {
        if (!this.positionFrame) {
            return "Load an image and select a region to use it";
        }
        if (!this.positionFrame.isValidWcs) {
            return "The active image has no valid WCS";
        }
        if (!this.activeRegion) {
            return "Select a closed region (not a point or line) to use it";
        }
        return `Set center and radius to ${this.activeRegion.nameString}`;
    }

    /** The focused region the search circle can be taken from, if it encloses an area. */
    @computed get activeRegion(): RegionStore | undefined {
        const region = this.positionFrame?.regionSet?.focusedRegion;
        return region?.isClosedRegion && region.boundingBox.x > 0 && region.boundingBox.y > 0 ? region : undefined;
    }

    /** Whether the search circle can be set from the focused region. */
    @computed get canSetFromRegion(): boolean {
        return !!this.positionFrame?.isValidWcs && !!this.activeRegion;
    }

    @action setServiceUrl = (serviceUrl: string) => {
        this.serviceUrl = serviceUrl;
    };

    @action setObject = (object: string) => {
        this.object = object;
    };

    @action setCenter = (ra: number, dec: number) => {
        this.center = {x: ra, y: dec};
    };

    @action setCenterX = (ra: number) => {
        this.center.x = ra;
    };

    @action setCenterY = (dec: number) => {
        this.center.y = dec;
    };

    @action setRadius = (radius: number) => {
        this.radius = radius;
    };

    @action setBandMin = (bandMin: number) => {
        this.bandMin = bandMin;
    };

    @action setBandMax = (bandMax: number) => {
        this.bandMax = bandMax;
    };

    /** Sets the wavelength range to a named band, or clears it when no band is given. */
    @action setBand = (band: SiaBand | undefined) => {
        this.bandMin = band ? band.min : NaN;
        this.bandMax = band ? band.max : NaN;
    };

    /**
     * Sets the time range to the given number of days before now, or clears it when given none.
     * @param days - The length of the range.
     * @param nowMillis - The end of the range, as a unix epoch time in milliseconds.
     */
    @action setRelativeTimeRange = (days: number | undefined, nowMillis = Date.now()) => {
        if (!days || !isFinite(days)) {
            this.timeMin = NaN;
            this.timeMax = NaN;
            return;
        }
        const range = SiaQueryStore.relativeMjdRange(days, nowMillis);
        this.timeMin = range.min;
        this.timeMax = range.max;
    };

    @action setTimeMin = (timeMin: number) => {
        this.timeMin = timeMin;
    };

    @action setTimeMax = (timeMax: number) => {
        this.timeMax = timeMax;
    };

    @action setPol = (pol: string[]) => {
        this.pol = pol;
    };

    @action setCollection = (collection: string) => {
        this.collection = collection;
    };

    @action setFacility = (facility: string) => {
        this.facility = facility;
    };

    @action setInstrument = (instrument: string) => {
        this.instrument = instrument;
    };

    @action setTarget = (target: string) => {
        this.target = target;
    };

    @action setResultFilter = (resultFilter: string) => {
        this.resultFilter = resultFilter;
    };

    @action setDpType = (dpType: SiaDataProductType) => {
        this.dpType = dpType;
    };

    @action setCalibLevels = (calibLevels: number[]) => {
        this.calibLevels = calibLevels;
    };

    @action setMaxrec = (maxrec: number) => {
        this.maxrec = maxrec;
    };

    @action setSelectedRecord = (record: CARTA.SiaRecord.$Properties | undefined) => {
        this.selectedRecordId = record?.index ?? -1;
    };

    @action setRecords = (records: CARTA.SiaRecord.$Properties[]) => {
        this.records = records;
        this.selectedRecordId = -1;
        this.resultFilter = "";
    };

    /**
     * Sorts the results by a record field, toggling the direction if it is already the sorted field.
     * @param key - The record field to sort by.
     */
    @action setSorting = (key: string) => {
        this.isSortAscending = key === this.sortColumn ? !this.isSortAscending : true;
        this.sortColumn = key;
    };

    /** Sets the search circle to the current view of the active image. */
    @action setFromView = () => {
        const frame = this.positionFrame;
        if (!this.canSetFromView || !frame?.center) {
            return;
        }
        const center = this.toDegrees(frame.center);
        if (!center) {
            return;
        }
        this.setCenter(center.x, center.y);
        this.radius = Number(CatalogOnlineQueryConfigStore.Instance.searchRadiusInDegree.toPrecision(6));
        this.object = "";
    };

    /** Sets the search circle to the bounding circle of the focused region. */
    @action setFromRegion = () => {
        const region = this.activeRegion;
        if (!this.canSetFromRegion || !region) {
            return;
        }
        const center = this.toDegrees(region.center);
        const corner = this.toDegrees({x: region.center.x + region.boundingBox.x / 2, y: region.center.y + region.boundingBox.y / 2});
        if (!center || !corner) {
            return;
        }
        const deltaRa = (corner.x - center.x) * Math.cos((center.y * Math.PI) / 180);
        const deltaDec = corner.y - center.y;
        this.setCenter(center.x, center.y);
        this.radius = Number(Math.hypot(deltaRa, deltaDec).toPrecision(6));
        this.object = "";
    };

    private toDegrees = (pixelCoords: Point2D): Point2D | null => {
        const degrees = CatalogOnlineQueryConfigStore.Instance.convertToDeg(pixelCoords, SystemType.ICRS, SiaQueryStore.DegreePrecision);
        const point = {x: Number(degrees.x), y: Number(degrees.y)};
        return isFinite(point.x) && isFinite(point.y) ? point : null;
    };

    /** Resets the query filters and results. */
    @action clear = () => {
        this.object = "";
        this.center = {x: NaN, y: NaN};
        this.radius = SiaQueryStore.DEFAULT_RADIUS;
        this.bandMin = NaN;
        this.bandMax = NaN;
        this.timeMin = NaN;
        this.timeMax = NaN;
        this.pol = [];
        this.collection = "";
        this.facility = "";
        this.instrument = "";
        this.target = "";
        this.dpType = SiaDataProductType.Any;
        this.calibLevels = [];
        this.maxrec = 100;
        this.queryError = "";
        this.records = [];
        this.selectedRecordId = -1;
        this.resultFilter = "";
        this.sortColumn = "";
        this.isSortAscending = true;
        this.serviceUrl = this.services[0]?.queryUrl ?? "";
    };

    /** Resolves the object name to center coordinates using SIMBAD. */
    @flow.bound *resolveObject() {
        if (!this.object) {
            return;
        }
        this.isResolvingObject = true;
        this.queryError = "";
        try {
            const coordinates: Point2D | undefined = yield CatalogApiService.Instance.resolveObjectCoordinates(this.object);
            if (coordinates) {
                this.setCenter(coordinates.x, coordinates.y);
            } else {
                this.queryError = `Object ${this.object} not found`;
            }
        } catch (err) {
            this.queryError = `Object resolution failed: ${err?.message ?? err}`;
        }
        this.isResolvingObject = false;
    }

    /** Performs the SIA query with the current filters via the backend. */
    @flow.bound *query() {
        this.isQuerying = true;
        this.queryError = "";
        this.setRecords([]);
        try {
            const response: CARTA.SiaQueryResponse.$Properties = yield BackendService.Instance.siaQuery(this.queryRequest);
            if (response.success) {
                this.setRecords(response.records ?? []);
            } else {
                this.queryError = `SIA query failed: ${response.message}`;
            }
        } catch (err) {
            this.queryError = `SIA query failed: ${err?.message ?? err}`;
        }
        this.isQuerying = false;
    }

    /**
     * Loads a query result by its index in the backend's cached result set; the backend
     * resolves DataLink records itself.
     * @param record - The record to load.
     */
    @flow.bound *loadRecord(record: CARTA.SiaRecord.$Properties) {
        this.queryError = "";
        this.isLoadingFile = true;
        try {
            const filename = record.obsId || record.targetName || "remote_image";
            yield AppStore.Instance.loadRemoteFile({siaRecordIndex: record.index, filename});
        } catch (err) {
            this.queryError = `Loading image failed: ${err?.message ?? err}`;
        }
        this.isLoadingFile = false;
    }
}
