import {WebsocketProvider} from "y-websocket";
import * as Y from "yjs";

import {AppStore} from "../stores";

export class WorkspaceService {
    private static staticInstance: WorkspaceService;
    private workspaceDoc: Y.Doc;
    private provider: WebsocketProvider;

    static get Instance() {
        return WorkspaceService.staticInstance || new WorkspaceService();
    }

    private constructor() {
        WorkspaceService.staticInstance = this;
    }

    public async setWorkspace(id: string) {
        this.workspaceDoc = new Y.Doc();
        this.provider = new WebsocketProvider("ws://localhost:1234", id, this.workspaceDoc);
        this.workspaceDoc.getMap("files").observe(event => {
            const fileMap = this.workspaceDoc.getMap("files").toJSON();
            console.log(fileMap);
            console.log(event);

            event.keysChanged.forEach(async key => {
                const appStore = AppStore.Instance;

                if (fileMap[key]) {
                    const newFile = fileMap[key];
                    console.log(`New file ${newFile.filename} opened with id ${key}`);
                    console.log(appStore.frames.map(f => f.replicatedId));
                    const existingFile = appStore.frames.find(f => f.replicatedId === key);
                    if (!existingFile) {
                        // Open file without replication
                        await appStore.loadFile(newFile.path, newFile.filename, newFile.hdu, false, false, false, key);
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

    public replicateOpenFile(id: string, fileId: string, path: string, filename: string, hdu: string, orderIndex: number) {
        this.workspaceDoc.getMap("files").set(id, {fileId, path, filename, hdu, orderIndex});
    }

    public replicateCloseFile(id: string) {
        this.workspaceDoc.getMap("files").delete(id);
    }
}
