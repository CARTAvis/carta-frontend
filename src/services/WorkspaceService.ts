import {makeObservable, observable} from "mobx";
import generateRandomAnimal from "random-animal-name";
import {v4 as uuidv4} from "uuid";
import {WebsocketProvider} from "y-websocket";
import * as Y from "yjs";

import {AppStore} from "../stores";
import {SWATCH_COLORS} from "../utilities";

export interface UserPresence {
    id: string;
    name: string;
    color: string;
    cursor?: {id: string; x: number; y: number};
}

export class WorkspaceService {
    private static staticInstance: WorkspaceService;
    private workspaceDoc: Y.Doc;
    private provider: WebsocketProvider;
    @observable presentUsers: UserPresence[];
    public userId: string;

    static get Instance() {
        return WorkspaceService.staticInstance || new WorkspaceService();
    }

    private constructor() {
        WorkspaceService.staticInstance = this;
        makeObservable(this);
    }

    public async setWorkspace(id: string) {
        this.workspaceDoc = new Y.Doc();
        const token = AppStore.Instance.apiService.accessToken;
        this.provider = new WebsocketProvider("wss://www.veggiesaurus.net/workspaces/api/collaboration", id, this.workspaceDoc, {params: {token}});
        const userNum = Math.floor(Math.random() * 1000);
        this.userId = uuidv4();
        this.provider.awareness.setLocalStateField("user", {
            id: this.userId,
            name: generateRandomAnimal(),
            color: SWATCH_COLORS[userNum % 14]
        });
        this.provider.awareness.on("change", () => {
            this.presentUsers = Array.from(this.provider.awareness.getStates().values()).map(({user, cursor}) => ({...user, cursor})) ?? [];
        });

        this.workspaceDoc.getMap("files").observe(event => {
            const fileMap = this.workspaceDoc.getMap("files").toJSON();

            event.keysChanged.forEach(async key => {
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
            });
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
