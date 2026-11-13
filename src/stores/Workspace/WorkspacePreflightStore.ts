import {action, computed, makeObservable, observable, runInAction} from "mobx";

import {CatalogDatabase} from "enums";
import {describeCatalogSource, describeImageSource, getLelFileNames, type Workspace, type WorkspaceCatalog, type WorkspaceCatalogSource, type WorkspaceFile, type WorkspaceImageSource} from "models";
import {CatalogApiService} from "services";
import {AppStore, MirrorSiteStore, showSourceWriteToast, type WorkspaceSourceWriteResult} from "stores";
import {type WorkspaceLeftOutItems, WorkspaceRestorer, type WorkspaceSourceChanges} from "stores/Workspace/WorkspaceRestorer";

import {describeRestoredSettings} from "./WorkspaceSummary";

/** What the check of a file found. */
export type WorkspaceFileStatus =
    /** The check has not ended yet. */
    | "checking"
    /** The file is where the workspace saved it. */
    | "found"
    /** The file is not where the workspace saved it, and the user has not chosen a new location. */
    | "missing"
    /** The file is at the new location that the user chose. */
    | "moved"
    /**
     * No file has the name, and the expression may name a region of an image with it, as in
     * `cube.fits[centre]`. The restore finds out when it opens the expression.
     */
    | "region";

/**
 * How an image, a catalog or a group of them stands before the workspace opens. The Workspace
 * dialog shows a group with the level of its worst item.
 */
export type WorkspaceCheckLevel =
    /** A check has not ended yet. */
    | "checking"
    /** Everything is found, or is made again when the workspace opens. */
    | "ok"
    /** Something is checked only when the workspace opens, such as an expression that cannot be read. */
    | "attention"
    /** The workspace opens without the item: a file is missing, or the mirror of a query does not answer. */
    | "left-out";

const LEVEL_ORDER: WorkspaceCheckLevel[] = ["ok", "attention", "left-out", "checking"];

/** Returns the level of a group: a check that has not ended, then the worst level of its items. */
function worstLevel(levels: WorkspaceCheckLevel[]): WorkspaceCheckLevel {
    return levels.reduce<WorkspaceCheckLevel>((worst, level) => (LEVEL_ORDER.indexOf(level) > LEVEL_ORDER.indexOf(worst) ? level : worst), "ok");
}

/** One file that a workspace reads, and its place in the workspace. */
export interface WorkspaceCheckedFile {
    /** Tells the files of one workspace apart, such as "image-3" or "image-4-stokes-1". */
    key: string;
    kind: "image" | "catalog";
    /** The workspace ID of the image or the catalog that reads the file. */
    itemId: number;
    /** How the file is part of its image. An image arithmetic expression keeps one folder for all its files. */
    part: "file" | "stokes" | "expression";
    /** The index of the file among the Stokes files of a hypercube. */
    stokesIndex?: number;
    /** The folder that the workspace saved, relative to the top folder of the backend. */
    directory: string;
    filename: string;
    hdu?: string;
    /** Whether the name in an expression may be the name of a region instead of a file. See `getLelFileNames`. */
    canBeRegion?: boolean;
}

/** A new location that the user chose for a file. A file of an expression changes only its folder. */
interface FileLocation {
    directory: string;
    filename: string;
    hdu?: string;
}

/** One image that a workspace opens or makes, as the Workspace dialog lists it. */
export interface WorkspaceImageSummary {
    /** The workspace ID of the image. */
    id: number;
    /** How the image is named, such as "cube.fits" or "Moment 0 of cube.fits". */
    name: string;
    /** The references that the image is, such as "spatial and spectral reference". */
    references?: string;
    regionCount: number;
    /** Whether the image is made again when the workspace opens, such as a moment image. */
    isGenerated: boolean;
    /** The files that the image reads. An expression whose files cannot be found from its text has none. */
    files: WorkspaceCheckedFile[];
    /** Whether the image is an expression or a hypercube, which lists each of its files. */
    hasParts: boolean;
    /** Whether the files of an expression cannot be found from its text, as when a quote is not closed. The restore checks them when it opens the expression. */
    isCheckedWhenOpened: boolean;
}

/** One catalog that a workspace opens, as the Workspace dialog lists it. */
export interface WorkspaceCatalogSummary {
    id: number;
    name: string;
    /** The file of a catalog file. */
    file?: WorkspaceCheckedFile;
    /** The database of an online query. */
    database?: CatalogDatabase;
}

/** The state of the mirror of an online database that the workspace queries. */
export interface WorkspaceMirrorCheck {
    /** The mirror that the workspace saved. */
    saved: string | undefined;
    /** The mirror that the restore uses. */
    chosen: string;
    state: "testing" | "answered" | "no-answer";
}

/** How long the test of a mirror waits for an answer, in milliseconds. */
const MIRROR_TEST_TIMEOUT_MS = 10000;

/**
 * Returns the parts of two folders that differ, when the folders end in the same names. For
 * example, `/data/alice/band6` and `/mnt/share/band6` give `/data/alice` and `/mnt/share`. When
 * the folders do not end in the same names, returns the two folders.
 */
export function getChangedFolderPrefix(oldDirectory: string, newDirectory: string): {from: string; to: string} {
    const oldParts = oldDirectory.split("/");
    const newParts = newDirectory.split("/");
    let shared = 0;
    while (shared < oldParts.length - 1 && shared < newParts.length - 1 && oldParts[oldParts.length - 1 - shared] === newParts[newParts.length - 1 - shared]) {
        shared++;
    }
    return {from: oldParts.slice(0, oldParts.length - shared).join("/"), to: newParts.slice(0, newParts.length - shared).join("/")};
}

/** Whether a folder is the given folder or a folder inside it. */
function isInFolder(directory: string, folder: string): boolean {
    return directory === folder || directory.startsWith(folder.endsWith("/") ? folder : `${folder}/`) || folder === "";
}

/** Returns the database of an online catalog source, or undefined for a catalog file. */
function databaseOf(source: WorkspaceCatalogSource): CatalogDatabase | undefined {
    return source.type === "simbad" ? CatalogDatabase.SIMBAD : source.type === "vizier" ? CatalogDatabase.VIZIER : undefined;
}

/**
 * Checks what a workspace needs before it opens, in the Workspace dialog: the files of its images
 * and catalogs, and the mirrors of its online queries. The user can choose new locations for the
 * missing files and other mirrors, save them to the workspace, and open the workspace without what
 * is still missing.
 *
 * A restore still stops for an item that fails only when it opens. For example, a file that is moved
 * after the check, or a moment image that the backend cannot make.
 */
export class WorkspacePreflightStore {
    /** The workspace as the dialog read it, after the new locations that were saved to it. */
    @observable.ref private workspace: Workspace;
    @observable.shallow private readonly statuses = new Map<string, WorkspaceFileStatus>();
    @observable.shallow private readonly moves = new Map<string, FileLocation>();
    @observable.shallow readonly mirrors = new Map<CatalogDatabase, WorkspaceMirrorCheck>();
    /** Whether the last save of new locations to the workspace was written. */
    @observable hasSavedChanges = false;
    @observable isSaving = false;
    /** The number of checks started. A check that a later check replaced does not change the statuses. */
    private checkCount = 0;

    /**
     * @param name - the name of the workspace, as the Workspace dialog lists it.
     * @param canSave - whether new locations can be written to the stored workspace.
     */
    constructor(
        readonly name: string,
        workspace: Workspace,
        readonly canSave: boolean
    ) {
        makeObservable(this);
        this.workspace = workspace;
        for (const database of this.databases) {
            const mirrorSiteStore = MirrorSiteStore.Instance;
            const saved = workspace.catalogMirrors?.[database];
            const isSavedAvailable = saved !== undefined && mirrorSiteStore.getMirrorSites(database).includes(saved) && !mirrorSiteStore.isMirrorUnavailable(database, saved);
            const chosen = isSavedAvailable ? saved : mirrorSiteStore.getActiveMirror(database);
            if (chosen) {
                this.mirrors.set(database, {saved, chosen, state: "testing"});
            }
        }
    }

    /** The online databases that the catalogs of the workspace query. */
    private get databases(): CatalogDatabase[] {
        const databases = (this.workspace.catalogs ?? []).map(catalog => databaseOf(catalog.source)).filter((database): database is CatalogDatabase => database !== undefined);
        return [...new Set(databases)];
    }

    /** The images that the workspace opens or makes, in the order that it saved them. */
    @computed get images(): WorkspaceImageSummary[] {
        const references = this.workspace.references ?? {};
        const referenceText = (id: number) => {
            const kinds = (["spatial", "spectral", "raster"] as const).filter(kind => references[kind] === id);
            return kinds.length ? `${kinds.join(", ")} reference` : undefined;
        };
        const regionCount = (file: WorkspaceFile) => file.regionsSet?.regions?.length ?? 0;
        const opened = (this.workspace.files ?? []).map(file => {
            const files = this.filesOf(file);
            return {
                id: file.id,
                name: describeImageSource(file.source),
                references: referenceText(file.id),
                regionCount: regionCount(file),
                isGenerated: false,
                files,
                hasParts: file.source?.type === "lel" || file.source?.type === "hypercube",
                isCheckedWhenOpened: file.source?.type === "lel" && !getLelFileNames(file.source.expression).isComplete
            };
        });
        const generated = (this.workspace.generatedImages ?? []).flatMap(({images}) =>
            (images ?? []).map(image => ({
                id: image.id,
                name: image.name || "A generated image",
                references: referenceText(image.id),
                regionCount: regionCount(image as WorkspaceFile),
                isGenerated: true,
                files: [],
                hasParts: false,
                isCheckedWhenOpened: false
            }))
        );
        return [...opened, ...generated];
    }

    @computed get catalogs(): WorkspaceCatalogSummary[] {
        return (this.workspace.catalogs ?? []).map(catalog => {
            const {source} = catalog;
            if (source.type === "file") {
                return {id: catalog.id, name: source.filename, file: {key: `catalog-${catalog.id}`, kind: "catalog", itemId: catalog.id, part: "file", directory: source.directory ?? "", filename: source.filename}};
            }
            const name = describeCatalogSource(source).replace(/^from the /, "");
            return {id: catalog.id, name: name.charAt(0).toUpperCase() + name.slice(1), database: databaseOf(source)};
        });
    }

    /** The settings that the workspace restores, besides its images, catalogs and regions. */
    @computed get restoredSettings(): string[] {
        return describeRestoredSettings(this.workspace);
    }

    @computed get thumbnail(): string | undefined {
        return this.workspace.thumbnail;
    }

    @computed get regionCount(): number {
        return this.images.reduce((count, image) => count + image.regionCount, 0);
    }

    /** Every file that the workspace reads. */
    @computed get files(): WorkspaceCheckedFile[] {
        return [...this.images.flatMap(image => image.files), ...this.catalogs.flatMap(catalog => (catalog.file ? [catalog.file] : []))];
    }

    private filesOf(fileInfo: WorkspaceFile): WorkspaceCheckedFile[] {
        const source = fileInfo.source;
        const key = `image-${fileInfo.id}`;
        switch (source?.type) {
            case "file":
                return [{key, kind: "image", itemId: fileInfo.id, part: "file", directory: source.directory ?? "", filename: source.filename, hdu: source.hdu}];
            case "hypercube":
                return source.stokesFiles.map((stokesFile, index) => ({
                    key: `${key}-stokes-${index}`,
                    kind: "image",
                    itemId: fileInfo.id,
                    part: "stokes",
                    stokesIndex: index,
                    directory: stokesFile.directory ?? source.directory ?? "",
                    filename: stokesFile.filename,
                    hdu: stokesFile.hdu ?? source.hdu
                }));
            case "lel":
                return getLelFileNames(source.expression).names.map(({name, canBeRegion}) => ({
                    key: `${key}-expression-${name}`,
                    kind: "image",
                    itemId: fileInfo.id,
                    part: "expression",
                    directory: source.directory ?? "",
                    filename: name,
                    canBeRegion
                }));
            default:
                return [];
        }
    }

    /** Returns the folder of a file, at its new location when the user chose one. */
    directoryOf = (file: WorkspaceCheckedFile): string => this.moves.get(file.key)?.directory ?? file.directory;

    /** Returns the path of a file relative to the top folder, at its new location when the user chose one. */
    pathOf = (file: WorkspaceCheckedFile): string => {
        const directory = this.directoryOf(file);
        const filename = this.moves.get(file.key)?.filename ?? file.filename;
        return directory ? `${directory}/${filename}` : filename;
    };

    statusOf = (file: WorkspaceCheckedFile): WorkspaceFileStatus => this.statuses.get(file.key) ?? "checking";

    /** Returns how an image stands before the workspace opens. */
    levelOfImage = (image: WorkspaceImageSummary): WorkspaceCheckLevel => {
        const statuses = image.files.map(file => this.statusOf(file));
        if (statuses.includes("checking")) {
            return "checking";
        }
        if (statuses.includes("missing")) {
            return "left-out";
        }
        return image.isCheckedWhenOpened ? "attention" : "ok";
    };

    /** Returns how a catalog stands before the workspace opens. */
    levelOfCatalog = (catalog: WorkspaceCatalogSummary): WorkspaceCheckLevel => {
        if (catalog.file) {
            const status = this.statusOf(catalog.file);
            return status === "checking" ? "checking" : status === "missing" ? "left-out" : "ok";
        }
        const state = catalog.database === undefined ? undefined : this.mirrors.get(catalog.database)?.state;
        return state === "testing" ? "checking" : state === "no-answer" ? "left-out" : "ok";
    };

    @computed get imagesLevel(): WorkspaceCheckLevel {
        return worstLevel(this.images.map(this.levelOfImage));
    }

    @computed get catalogsLevel(): WorkspaceCheckLevel {
        return worstLevel(this.catalogs.map(this.levelOfCatalog));
    }

    /** Whether a check of a file or a mirror has not ended yet. */
    @computed get isChecking(): boolean {
        return this.files.some(file => this.statusOf(file) === "checking") || [...this.mirrors.values()].some(mirror => mirror.state === "testing");
    }

    @computed get missingFiles(): WorkspaceCheckedFile[] {
        return this.files.filter(file => this.statusOf(file) === "missing");
    }

    /** The images and catalogs that the workspace opens without, while their files are missing or their mirror does not answer. */
    @computed get leftOut(): WorkspaceLeftOutItems {
        const imageIds = new Set<number>();
        const catalogIds = new Set<number>();
        for (const file of this.missingFiles) {
            (file.kind === "image" ? imageIds : catalogIds).add(file.itemId);
        }
        for (const catalog of this.catalogs) {
            if (catalog.database !== undefined && this.mirrors.get(catalog.database)?.state === "no-answer") {
                catalogIds.add(catalog.id);
            }
        }
        return {imageIds: [...imageIds], catalogIds: [...catalogIds]};
    }

    @computed get leftOutCount(): number {
        return this.leftOut.imageIds.length + this.leftOut.catalogIds.length;
    }

    /** The new sources and mirrors that the user chose, compared with the workspace as it was read. */
    @computed get changes(): WorkspaceSourceChanges {
        const images: WorkspaceSourceChanges["images"] = new Map();
        for (const fileInfo of this.workspace.files ?? []) {
            const source = this.movedImageSource(fileInfo);
            if (source) {
                images.set(fileInfo.id, {from: fileInfo.source, to: source});
            }
        }
        const catalogs: WorkspaceSourceChanges["catalogs"] = new Map();
        for (const catalog of this.workspace.catalogs ?? []) {
            const source = this.movedCatalogSource(catalog);
            if (source) {
                catalogs.set(catalog.id, {from: catalog.source, to: source});
            }
        }
        const mirrors: NonNullable<WorkspaceSourceChanges["mirrors"]> = new Map();
        for (const [database, mirror] of this.mirrors) {
            if (mirror.chosen !== mirror.saved && mirror.state === "answered") {
                mirrors.set(database, {from: mirror.saved, to: mirror.chosen});
            }
        }
        return {images, catalogs, mirrors};
    }

    /** The changes that are not saved to the workspace, as the user reads them, such as "cube.fits → /data/new". */
    @computed get changeDescriptions(): string[] {
        const {images, catalogs, mirrors} = this.changes;
        const moved = this.files.filter(file => this.moves.has(file.key) && (file.kind === "image" ? images.has(file.itemId) : catalogs.has(file.itemId)));
        return [...moved.map(file => `${file.filename} → ${this.directoryOf(file) || "/"}`), ...[...(mirrors ?? [])].map(([database, {to}]) => `${database} → ${to}`)];
    }

    /** The workspace with the new sources and mirrors, as the restore opens it. */
    @computed get preparedWorkspace(): Workspace {
        return WorkspaceRestorer.withRepointedSources(this.workspace, this.changes) ?? this.workspace;
    }

    private movedImageSource(fileInfo: WorkspaceFile): WorkspaceImageSource | undefined {
        const source = fileInfo.source;
        const files = this.filesOf(fileInfo).filter(file => this.moves.has(file.key));
        if (!source || !files.length) {
            return undefined;
        }
        switch (source.type) {
            case "file": {
                const {directory, filename, hdu} = this.moves.get(files[0].key)!;
                return {type: "file", directory, filename, hdu};
            }
            case "hypercube":
                return {
                    ...source,
                    stokesFiles: source.stokesFiles.map((stokesFile, index) => {
                        const move = this.moves.get(`image-${fileInfo.id}-stokes-${index}`);
                        return move ? {...stokesFile, directory: move.directory, filename: move.filename, hdu: move.hdu} : stokesFile;
                    })
                };
            case "lel":
                return {...source, directory: this.moves.get(files[0].key)!.directory};
            default:
                return undefined;
        }
    }

    private movedCatalogSource(catalog: WorkspaceCatalog): WorkspaceCatalogSource | undefined {
        const move = this.moves.get(`catalog-${catalog.id}`);
        return move && catalog.source.type === "file" ? {type: "file", directory: move.directory, filename: move.filename} : undefined;
    }

    /** Checks every file and tests every mirror. A check that is still running is replaced. */
    check = async (): Promise<void> => {
        const count = ++this.checkCount;
        const files = this.files;
        runInAction(() => files.forEach(file => this.statuses.set(file.key, "checking")));
        const results = await Promise.all(files.map(file => this.exists(file)));
        if (count !== this.checkCount) {
            return;
        }
        runInAction(() =>
            files.forEach((file, index) => {
                const status = results[index] ? (this.moves.has(file.key) ? "moved" : "found") : file.canBeRegion ? "region" : "missing";
                this.statuses.set(file.key, status);
            })
        );
    };

    /** Tests every mirror. */
    testMirrors = (): Promise<void[]> => Promise.all([...this.mirrors.entries()].map(([database, mirror]) => this.testMirror(database, mirror.chosen)));

    private exists = async (file: WorkspaceCheckedFile): Promise<boolean> => {
        const backendService = AppStore.Instance.backendService;
        const move = this.moves.get(file.key);
        const directory = move?.directory ?? file.directory;
        const filename = move?.filename ?? file.filename;
        try {
            if (file.kind === "catalog") {
                return !!(await backendService.getCatalogFileInfo(directory, filename))?.success;
            }
            return !!(await backendService.getFileInfo(directory, filename, move?.hdu ?? file.hdu ?? ""))?.success;
        } catch {
            return false;
        }
    };

    /** Tests a mirror of a database, and makes it the mirror that the restore uses. */
    testMirror = async (database: CatalogDatabase, mirror: string): Promise<void> => {
        const check = this.mirrors.get(database);
        if (!check) {
            return;
        }
        runInAction(() => this.mirrors.set(database, {...check, chosen: mirror, state: "testing"}));
        const time = await CatalogApiService.Instance.benchmarkMirror(database, mirror, MIRROR_TEST_TIMEOUT_MS);
        // A later test of another mirror of the database replaces this one.
        if (this.mirrors.get(database)?.chosen === mirror) {
            runInAction(() => this.mirrors.set(database, {...this.mirrors.get(database)!, state: time === null ? "no-answer" : "answered"}));
        }
    };

    /**
     * Uses a new location for a file. An expression keeps one folder for all its files, so the new
     * folder is used for every file of the expression.
     */
    @action setLocation = (file: WorkspaceCheckedFile, location: FileLocation) => {
        if (file.part === "expression") {
            const expressionFiles = this.files.filter(other => other.itemId === file.itemId && other.kind === "image" && other.part === "expression");
            expressionFiles.forEach(other => this.moves.set(other.key, {directory: location.directory, filename: other.filename}));
        } else {
            this.moves.set(file.key, location);
        }
        this.hasSavedChanges = false;
    };

    /**
     * Returns how the other missing files move, when they move the way a file moved. For example,
     * when `/data/alice/band6/cube.fits` moved to `/mnt/share/band6`, a missing file in
     * `/data/alice/catalogs` moves to `/mnt/share/catalogs`.
     */
    getFolderMove = (file: WorkspaceCheckedFile, oldDirectory: string): {from: string; to: string; files: WorkspaceCheckedFile[]} => {
        const {from, to} = getChangedFolderPrefix(oldDirectory, this.directoryOf(file));
        const sameItem = (other: WorkspaceCheckedFile) => other.part === "expression" && file.part === "expression" && other.itemId === file.itemId;
        const files = this.missingFiles.filter(other => other.key !== file.key && !sameItem(other) && isInFolder(this.directoryOf(other), from));
        return {from, to, files};
    };

    /** Moves files the way {@link getFolderMove} returned. */
    @action moveFolder = (move: {from: string; to: string; files: WorkspaceCheckedFile[]}) => {
        // Work out every new location before any file moves. The files of an expression move together.
        const locations = move.files.map(file => {
            const rest = this.directoryOf(file).slice(move.from.length).replace(/^\//, "");
            return {file, location: {directory: [move.to, rest].filter(Boolean).join("/"), filename: this.moves.get(file.key)?.filename ?? file.filename, hdu: this.moves.get(file.key)?.hdu ?? file.hdu}};
        });
        locations.forEach(({file, location}) => this.setLocation(file, location));
    };

    /** Writes the new locations and mirrors to the stored workspace. */
    saveChanges = async (): Promise<WorkspaceSourceWriteResult> => {
        runInAction(() => (this.isSaving = true));
        const result = await AppStore.Instance.writeWorkspaceSourceChanges(this.name, this.changes);
        runInAction(() => {
            this.isSaving = false;
            if (result.state === "written") {
                this.workspace = result.workspace;
                this.moves.clear();
                for (const [database, mirror] of this.mirrors) {
                    this.mirrors.set(database, {...mirror, saved: mirror.chosen});
                }
                for (const [key, status] of this.statuses) {
                    if (status === "moved") {
                        this.statuses.set(key, "found");
                    }
                }
                this.hasSavedChanges = true;
            }
        });
        if (result.state !== "written") {
            showSourceWriteToast(result, this.name, "read");
        }
        return result;
    };
}
