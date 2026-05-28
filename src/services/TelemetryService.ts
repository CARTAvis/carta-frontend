import axios, {type AxiosInstance} from "axios";
import {CARTA} from "carta-protobuf";
import {type DBSchema, type IDBPDatabase, openDB} from "idb";
import {jwtDecode} from "jwt-decode";
import {computed, flow, makeObservable, observable} from "mobx";
import {v1 as uuidv1} from "uuid";

import {PreferenceKeys, TelemetryAction, TelemetryMode} from "enums";
import {CARTA_INFO} from "models";
import {PreferenceStore} from "stores";
import {getUnixTimestamp} from "utilities";

export interface TelemetryMessage {
    timestamp: number;
    id: string;
    sessionId: string;
    usageEntry?: boolean;
    action: TelemetryAction;
    version: string;
    details?: any;
}

interface TelemetryDb extends DBSchema {
    entries: {
        value: TelemetryMessage;
        key: number;
    };
}

export class TelemetryService {
    private static staticInstance: TelemetryService;

    public static readonly SERVER_URL = "https://telemetry.cartavis.org";
    private static readonly SubmissionIntervalSeconds = 300;
    private static readonly EntryLimit = 1000;
    private static readonly DbName = "telemetry";
    private static readonly StoreName = "entries";

    public static get Instance() {
        if (!TelemetryService.staticInstance) {
            TelemetryService.staticInstance = new TelemetryService();
        }
        return TelemetryService.staticInstance;
    }

    @computed get effectiveTelemetryMode() {
        const preferences = PreferenceStore.Instance;
        if (!this.shouldSkipTelemetry && preferences.hasTelemetryConsentShown && preferences.telemetryUuid) {
            return preferences.telemetryMode;
        }
        return TelemetryMode.None;
    }

    @computed get isConsentRequired() {
        const preferences = PreferenceStore.Instance;
        return !this.shouldSkipTelemetry && !preferences.hasTelemetryConsentShown;
    }

    @computed get decodedUserId() {
        return this.uuid;
    }

    private readonly sessionId: string;
    private readonly axiosInstance: AxiosInstance;
    private db: IDBPDatabase<TelemetryDb>;
    @observable private uuid: string = "";
    @observable private shouldSkipTelemetry: boolean = false;
    private telemetrySubmissionHandle: ReturnType<typeof setInterval> | undefined;

    private constructor() {
        this.axiosInstance = axios.create({
            baseURL: TelemetryService.SERVER_URL
        });
        this.sessionId = uuidv1();
        // Submit accumulated telemetry every 5 minutes, and when the user closes the frontend

        window.onbeforeunload = ev => {
            this.flushTelemetry(true);
            ev.preventDefault();
        };

        this.telemetrySubmissionHandle = setInterval(this.flushTelemetry, TelemetryService.SubmissionIntervalSeconds * 1000);
        window.addEventListener("unload", this.dispose);
        makeObservable(this);
    }

    public dispose = () => {
        clearInterval(this.telemetrySubmissionHandle);
        this.telemetrySubmissionHandle = undefined;
        window.removeEventListener("unload", this.dispose);
    };

    @flow.bound *checkAndGenerateId(shouldFlush: boolean = false, shouldForceNewId: boolean = false) {
        const url = new URL(window.location.href);
        const skipTelemetry = url.searchParams.get("skipTelemetry");
        // Check for URL query parameter or build-time flag for skipping telemetry
        if (skipTelemetry || process.env.PUBLIC_REACT_APP_SKIP_TELEMETRY === "true") {
            console.log(`Skipping telemetry due to ${skipTelemetry ? "URL override" : "build-time override"}`);
            this.shouldSkipTelemetry = true;
            return false;
        }

        const preferences = PreferenceStore.Instance;
        let token = preferences.telemetryUuid;

        if (!token || shouldForceNewId) {
            try {
                const res = yield this.axiosInstance.get("/api/token");
                token = res.data?.token;
                const decodedObject = jwtDecode(token) as any;
                if (decodedObject?.uuid) {
                    yield preferences.setPreference(PreferenceKeys.TELEMETRY_UUID, token);
                    console.log(`Generated new telemetry ID ${decodedObject.uuid}. This will only be used if telemetry consent is given.`);
                    if (shouldForceNewId) {
                        yield this.clearTelemetry();
                    }
                }
            } catch (err) {
                console.warn("Could not generate telemetry UUID");
                console.error(err);
                return false;
            }
        }

        if (!token) {
            console.warn("Could not generate telemetry UUID");
            return false;
        }

        try {
            const decodedObject: {uuid?: string} = jwtDecode(token);
            if (decodedObject?.uuid) {
                this.uuid = decodedObject.uuid;
            }
        } catch (err) {
            console.warn("Malformed telemetry token");
            console.error(err);
            return false;
        }

        this.axiosInstance.defaults.headers.common = {Authorization: `Bearer ${token}`};

        if (shouldFlush) {
            this.flushTelemetry();
        }

        return true;
    }

    async optIn(mode: TelemetryMode) {
        const preferences = PreferenceStore.Instance;
        await preferences.setPreference(PreferenceKeys.TELEMETRY_CONSENT_SHOWN, true);
        await preferences.setPreference(PreferenceKeys.TELEMETRY_MODE, mode);

        const entry: TelemetryMessage = {
            timestamp: getUnixTimestamp(),
            id: uuidv1(),
            sessionId: this.sessionId,
            version: CARTA_INFO.version,
            action: TelemetryAction.OptIn
        };

        try {
            await this.axiosInstance.post("/api/submit", [entry]);
        } catch (err) {
            console.log("Telemetry server unavailable");
            console.error(err);
        }
    }

    async optOut() {
        const preferences = PreferenceStore.Instance;
        await preferences.setPreference(PreferenceKeys.TELEMETRY_CONSENT_SHOWN, true);
        await preferences.setPreference(PreferenceKeys.TELEMETRY_MODE, TelemetryMode.None);

        const entry: TelemetryMessage = {
            id: uuidv1(),
            timestamp: getUnixTimestamp(),
            sessionId: this.sessionId,
            version: CARTA_INFO.version,
            action: TelemetryAction.OptOut
        };

        try {
            await this.axiosInstance.post("/api/submit", [entry]);
        } catch (err) {
            console.log("Telemetry server unavailable");
            console.error(err);
        }
    }

    flushTelemetry = async (shouldIncludeEndSession: boolean = false) => {
        if (this.effectiveTelemetryMode !== TelemetryMode.None) {
            if (this.effectiveTelemetryMode === TelemetryMode.Minimal) {
                // TODO: Filter DB entries to remove usage stats if any exist in current DB
            }

            if (!this.uuid) {
                await this.checkAndGenerateId();
            }

            const db = await this.getDb();
            const entries = (await db.getAll(TelemetryService.StoreName)) ?? [];

            if (shouldIncludeEndSession) {
                const endSessionEntry: TelemetryMessage = {
                    id: uuidv1(),
                    timestamp: getUnixTimestamp(),
                    sessionId: this.sessionId,
                    version: CARTA_INFO.version,
                    action: TelemetryAction.EndSession,
                    usageEntry: false
                };

                entries.push(endSessionEntry);
                // Add telemetry entry without waiting for the promise to return, to prevent it interrupting the window unload handler
                this.addTelemetryEntry(TelemetryAction.EndSession, undefined, endSessionEntry.id);
            }

            if (!entries?.length) {
                return;
            }

            try {
                const res = await this.axiosInstance.post("/api/submit", entries);
                if (res.status === 200) {
                    await this.clearTelemetry();
                    console.debug(`Submitted ${entries.length} telemetry entries`);
                }
            } catch (err) {
                console.debug("Telemetry server not available");
                console.error(err);
            }
        }
    };

    async clearTelemetry() {
        const db = await this.getDb();
        await db.clear(TelemetryService.StoreName);
    }

    async getDb() {
        if (!this.db) {
            this.db = await openDB<TelemetryDb>(TelemetryService.DbName, 1, {
                upgrade(database: IDBPDatabase<TelemetryDb>) {
                    database.createObjectStore(TelemetryService.StoreName, {
                        keyPath: "timestamp"
                    });
                }
            });
        }
        return this.db;
    }

    addFileOpenEntry(id: number, type: CARTA.FileType, width: number, height: number, depth: number, stokes: number, isGenerated: boolean) {
        const fileType = Object.keys(CARTA.FileType).find(key => CARTA.FileType[key] === type);
        return this.addTelemetryEntry(TelemetryAction.FileOpen, {id, fileType, width, height, depth, stokes, generated: isGenerated});
    }

    addFileCloseEntry(id: number) {
        return this.addTelemetryEntry(TelemetryAction.FileClose, {id});
    }

    addSpectralProfileEntry(profileLength: number, regionType: CARTA.RegionType, regionId: number, width: number, height: number, depth: number) {
        switch (regionType) {
            case CARTA.RegionType.POINT:
                TelemetryService.Instance.addTelemetryEntry(TelemetryAction.SpectralProfileGeneration, {profileLength, regionId: regionId, regionType, depth});
                break;
            case CARTA.RegionType.RECTANGLE:
            case CARTA.RegionType.POLYGON:
                TelemetryService.Instance.addTelemetryEntry(TelemetryAction.SpectralProfileGeneration, {profileLength, regionId: regionId, regionType, width, height, depth});
                break;
            case CARTA.RegionType.ELLIPSE:
                TelemetryService.Instance.addTelemetryEntry(TelemetryAction.SpectralProfileGeneration, {profileLength, regionId: regionId, regionType, semi_major: width, semi_minor: height, depth});
                break;
            default:
                break;
        }
    }

    async addTelemetryEntry(action: TelemetryAction, details?: object, id?: string) {
        // All other actions are considered usage stats
        const isUsageEntry = !(action === TelemetryAction.Connection || action === TelemetryAction.EndSession);
        const preferences = PreferenceStore.Instance;
        const isLoggingEnabled = preferences.isTelemetryLogging;
        const loggingPrefix = `[Telemetry] [uuid=${this.uuid}, sessionId=${this.sessionId}]`;
        const timestamp = getUnixTimestamp();

        const isEntryAllowed = this.effectiveTelemetryMode === TelemetryMode.Usage || (!isUsageEntry && this.effectiveTelemetryMode === TelemetryMode.Minimal);
        if (isEntryAllowed) {
            const telemetryMessage: TelemetryMessage = {
                id: id || uuidv1(),
                timestamp,
                sessionId: this.sessionId,
                version: CARTA_INFO.version,
                action,
                details,
                usageEntry: isUsageEntry
            };

            if (isLoggingEnabled) {
                console.debug(`${loggingPrefix} ${telemetryMessage.action} ${details ? JSON.stringify(details) : ""}`);
            }

            try {
                const db = await this.getDb();
                let numEntries = await db.count(TelemetryService.StoreName);
                if (numEntries >= TelemetryService.EntryLimit) {
                    // Create a single transaction that deletes oldest telemetry entries to make space
                    const tx = db.transaction(TelemetryService.StoreName, "readwrite");
                    const cursor = await tx.store.openCursor();
                    const store = tx.store;
                    if (cursor && store) {
                        while (numEntries >= TelemetryService.EntryLimit) {
                            tx.store.delete(cursor.key);
                            await cursor.continue();
                            numEntries--;
                        }
                        tx.store.add(telemetryMessage);
                        await tx.done;
                    }
                } else {
                    await db.add(TelemetryService.StoreName, telemetryMessage);
                }
            } catch (err) {
                console.warn(err);
            }
        } else if (isLoggingEnabled) {
            console.debug(`${loggingPrefix} NO-OP (disabled due to ${preferences.hasTelemetryConsentShown ? "user preference" : "lack of explicit consent"})`);
        }
    }
}
