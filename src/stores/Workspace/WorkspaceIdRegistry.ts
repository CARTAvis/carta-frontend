import {action, makeObservable, observable} from "mobx";

import {type WorkspaceIdentifiedItemKind} from "enums";

/** One item kind's IDs, in both directions. */
class ItemIds {
    /** Session file ID to the workspace ID this session gave it. */
    readonly workspaceIds = observable.map<number, number>();
    /** Workspace ID to the session file ID it now refers to. */
    readonly sessionIds = observable.map<number, number>();
}

/**
 * The IDs a workspace knows this session's images and catalogs by.
 *
 * A session file ID says nothing across a save: it is handed out when a file is opened and handed
 * out again to a different file after that one is closed, so a widget that named a catalog by it
 * would come back pointing at whatever now holds that number. A workspace ID is given to an item
 * when it is opened and belongs to it for as long as it is loaded, which is what lets a saved
 * workspace, and the widgets inside it, name the same item twice.
 *
 * An ID is allocated when an item is opened rather than when a workspace is saved, so that saving
 * only reads. Restoring is the one case where the ID comes from outside: a workspace already names
 * its items, so those IDs are adopted rather than allocated.
 */
export class WorkspaceIdRegistry {
    private static staticInstance: WorkspaceIdRegistry;

    public static get Instance() {
        if (!WorkspaceIdRegistry.staticInstance) {
            WorkspaceIdRegistry.staticInstance = new WorkspaceIdRegistry();
        }
        return WorkspaceIdRegistry.staticInstance;
    }

    private readonly items = new Map<WorkspaceIdentifiedItemKind, ItemIds>();

    private constructor() {
        makeObservable(this);
    }

    private idsOf(kind: WorkspaceIdentifiedItemKind): ItemIds {
        let ids = this.items.get(kind);
        if (!ids) {
            ids = new ItemIds();
            this.items.set(kind, ids);
        }
        return ids;
    }

    /**
     * Give a newly opened item the ID a workspace will know it by, or return the one it already has.
     *
     * @returns the item's workspace ID.
     */
    @action register = (kind: WorkspaceIdentifiedItemKind, sessionId: number): number => {
        const ids = this.idsOf(kind);
        const existingId = ids.workspaceIds.get(sessionId);
        if (existingId !== undefined) {
            return existingId;
        }

        let workspaceId = 1;
        while (ids.sessionIds.has(workspaceId)) {
            workspaceId++;
        }
        this.bind(kind, sessionId, workspaceId);
        return workspaceId;
    };

    /**
     * Take the ID a workspace already knows an item by, for an item that has just been restored
     * from it. Whatever else held that ID gives it up: the workspace being restored is the
     * authority on which item it names.
     */
    @action adopt = (kind: WorkspaceIdentifiedItemKind, sessionId: number, workspaceId: number): void => {
        const ids = this.idsOf(kind);
        const displacedSessionId = ids.sessionIds.get(workspaceId);
        if (displacedSessionId !== undefined && displacedSessionId !== sessionId) {
            ids.workspaceIds.delete(displacedSessionId);
        }
        this.bind(kind, sessionId, workspaceId);
    };

    /** Give up the ID an item held, now that it is closed. */
    @action release = (kind: WorkspaceIdentifiedItemKind, sessionId: number): void => {
        const ids = this.idsOf(kind);
        const workspaceId = ids.workspaceIds.get(sessionId);
        if (workspaceId !== undefined) {
            ids.sessionIds.delete(workspaceId);
        }
        ids.workspaceIds.delete(sessionId);
    };

    /** The ID a workspace knows a loaded item by, if it has one. */
    public workspaceIdOf = (kind: WorkspaceIdentifiedItemKind, sessionId: number | undefined): number | undefined => {
        return sessionId === undefined ? undefined : this.idsOf(kind).workspaceIds.get(sessionId);
    };

    /** The session file ID a workspace ID now refers to, if that item is loaded. */
    public sessionIdOf = (kind: WorkspaceIdentifiedItemKind, workspaceId: number | undefined): number | undefined => {
        return workspaceId === undefined ? undefined : this.idsOf(kind).sessionIds.get(workspaceId);
    };

    /** Forget the ID of every loaded item of one kind, for a session that is being emptied. */
    @action clear = (kind: WorkspaceIdentifiedItemKind): void => {
        const ids = this.idsOf(kind);
        ids.workspaceIds.clear();
        ids.sessionIds.clear();
    };

    private bind(kind: WorkspaceIdentifiedItemKind, sessionId: number, workspaceId: number): void {
        const ids = this.idsOf(kind);
        const previousWorkspaceId = ids.workspaceIds.get(sessionId);
        if (previousWorkspaceId !== undefined && previousWorkspaceId !== workspaceId) {
            ids.sessionIds.delete(previousWorkspaceId);
        }
        ids.workspaceIds.set(sessionId, workspaceId);
        ids.sessionIds.set(workspaceId, sessionId);
    }
}
