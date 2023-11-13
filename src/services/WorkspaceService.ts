import {makeObservable, observable} from "mobx";
import {PerfectCursor} from "perfect-cursors";
import generateRandomAnimal from "random-animal-name";
import {v4 as uuidv4} from "uuid";
import {WebsocketProvider} from "y-websocket";
import * as Y from "yjs";

import {Point2D} from "../models";
import {AppStore} from "../stores";
import {SWATCH_COLORS} from "../utilities";

export interface UserPresence {
    id: string;
    name: string;
    color: string;
    cursor?: {id: string; x: number; y: number};
    view?: {id: string; center: Point2D; zoom: number};
}

export class WorkspaceService {
    private static staticInstance: WorkspaceService;
    private workspaceDoc: Y.Doc;
    private provider: WebsocketProvider;
    @observable presentUsers: UserPresence[];
    @observable.deep interpolatedCursorPoints = new Map<string, Point2D>();

    private interpolatedCursorHandlers = new Map<string, PerfectCursor>();

    public userId: string;

    static get Instance() {
        return WorkspaceService.staticInstance || new WorkspaceService();
    }

    private constructor() {
        WorkspaceService.staticInstance = this;
        makeObservable(this);
    }

    public updateCursorPoint(id: string, x: number, y: number) {
        this.interpolatedCursorPoints.set(id, {x, y});
    }

    public async setWorkspace(id: string) {
        this.workspaceDoc = new Y.Doc();
        const token = AppStore.Instance.apiService.accessToken;
        this.provider = new WebsocketProvider("wss://carta-yjs.veggiesaurus.ngrok.io/api/collaboration", id, this.workspaceDoc, {params: {token}});
        const userNum = Math.floor(Math.random() * 1000);
        this.userId = uuidv4();
        this.provider.awareness.setLocalStateField("user", {
            id: this.userId,
            name: generateRandomAnimal(),
            color: SWATCH_COLORS[userNum % 14]
        });
        this.provider.awareness.on("change", () => {
            this.presentUsers = Array.from(this.provider.awareness.getStates().values()).map(({user, cursor}) => ({...user, cursor})) ?? [];
            for (const user of this.presentUsers) {
                if (user.cursor) {
                    const key = `${user.id}-${user.cursor.id}`;
                    let cursor = this.interpolatedCursorHandlers.get(key);
                    if (!cursor) {
                        cursor = new PerfectCursor(point => this.updateCursorPoint(key, point[0], point[1]));
                        this.interpolatedCursorHandlers.set(key, cursor);
                    }
                    cursor.addPoint([user.cursor.x, user.cursor.y]);
                } else {
                }
            }
        });

        this.workspaceDoc.getMap("files").observe(async event => {
            const fileMap = this.workspaceDoc.getMap("files").toJSON();

            for (const key of event.keysChanged) {
                const appStore = AppStore.Instance;

                if (fileMap[key]) {
                    const newFile = fileMap[key];
                    console.log(`New file ${newFile.filename} opened with id ${key}`);
                    console.log(appStore.frames.map(f => f.replicatedId));
                    const existingFile = appStore.frames.find(f => f.replicatedId === key);
                    if (!existingFile) {
                        // Open file without replication
                        await appStore.loadFile(newFile.directory, newFile.filename, newFile.hdu, false, false, false, key);
                    }
                } else {
                    console.log(`File ${key} closed`);
                    const existingFile = appStore.frames.find(f => f.replicatedId === key);
                    if (existingFile) {
                        // Close file without replication
                        await appStore.closeFile(existingFile, false, false);
                    }
                }
            }
        });
    }

    public setPresenceCursor(id: string, x: number, y: number) {
        this.provider?.awareness?.setLocalStateField("cursor", {id, x, y});
    }

    public clearPresenceCursor() {
        this.provider?.awareness?.setLocalStateField("cursor", undefined);
    }

    public replicateOpenFile(id: string, fileId: number, directory: string, filename: string, hdu: string, orderIndex: number) {
        if (!this.workspaceDoc?.getMap("files")) {
            return false;
        }
        this.workspaceDoc.getMap("files").set(id, {fileId, directory, filename, hdu, orderIndex});
        return true;
    }

    public replicateCloseFile(id: string) {
        if (!this.workspaceDoc?.getMap("files")) {
            return false;
        }
        this.workspaceDoc.getMap("files").delete(id);
        return true;
    }
}
