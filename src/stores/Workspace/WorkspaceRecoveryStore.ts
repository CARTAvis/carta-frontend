import {action, computed, makeObservable, observable} from "mobx";

import {type CatalogDatabase, type WorkspaceItemKind} from "enums";

/** A file that the user chose in the file browser, as its new location. */
export interface WorkspaceFileLocation {
    directory: string;
    filename: string;
    hdu?: string;
}

/** What the user can do with an item that a restore could not open or make. */
export enum WorkspaceRecoveryAction {
    /** Open the item again, as it is saved. */
    Retry = "retry",
    /** Open the item from a file that the user chooses. */
    Repoint = "repoint",
    /** Leave the item out, with everything that depends on it. */
    Skip = "skip"
}

export type WorkspaceRecoveryChoice = {action: WorkspaceRecoveryAction.Retry} | {action: WorkspaceRecoveryAction.Skip} | {action: WorkspaceRecoveryAction.Repoint; location: WorkspaceFileLocation};

/** One item that a restore could not open or make, and what the user can do with it. */
export interface WorkspaceRecoveryItem {
    kind: WorkspaceItemKind;
    /** How the item is named to the user. */
    subject: string;
    /** Why the item failed, as a whole sentence naming the item. */
    message: string;
    /** How the restore report names the item, if the user skips it. See {@link WorkspaceIssue.label}. */
    label?: string;
    /** Why the item failed, without the name of the item. */
    reason?: string;
    /** The kind of file that the user can choose for the item. Undefined when the item is not a file. */
    repointKind?: "image" | "catalog";
    /** Whether the item can be opened again as it is saved, such as an online query. */
    canRetry: boolean;
    /** The online database of the item. The user can choose another mirror of it before a retry. */
    database?: CatalogDatabase;
    /** What the restore leaves out with the item when the user skips it, such as "2 regions". */
    dependents: string[];
}

/**
 * The items of one restore stage that failed, and the choice that the user makes for each item.
 *
 * The restore waits for `decided` before it continues the stage. The promise resolves when the
 * user continues, or skips all items. It also resolves when the restore is cancelled or a later load
 * starts. Then every item is skipped, and the restore sees that it no longer owns the session.
 */
export class WorkspaceRecoveryStore {
    @observable.shallow private readonly choices = new Map<number, WorkspaceRecoveryChoice>();
    /** Resolves with the choice for each item, in the order of `items`. */
    public readonly decided: Promise<WorkspaceRecoveryChoice[]>;
    private resolve!: (choices: WorkspaceRecoveryChoice[]) => void;
    @observable private isDecided = false;

    constructor(
        /** The stage that the items belong to, such as "Opening images". */
        public readonly stage: string,
        public readonly items: readonly WorkspaceRecoveryItem[]
    ) {
        makeObservable(this);
        this.decided = new Promise(resolve => (this.resolve = resolve));
    }

    /** Returns the choice made for the item at `index`, or undefined when there is none yet. */
    public choiceOf(index: number): WorkspaceRecoveryChoice | undefined {
        return this.choices.get(index);
    }

    @action setChoice(index: number, choice: WorkspaceRecoveryChoice): void {
        if (!this.isDecided && index >= 0 && index < this.items.length) {
            this.choices.set(index, choice);
        }
    }

    /** Whether every item has a choice. Then the user can continue. */
    @computed get canContinue(): boolean {
        return !this.isDecided && this.items.every((_, index) => this.choices.has(index));
    }

    /** Continue the stage, with the choice made for each item. */
    @action continue = (): void => {
        if (this.canContinue) {
            this.finish(this.items.map((_, index) => this.choices.get(index)!));
        }
    };

    /** Skip every item, whatever was chosen for it, and continue the stage. */
    @action skipAll = (): void => {
        this.finish(this.items.map(() => ({action: WorkspaceRecoveryAction.Skip})));
    };

    /** End the wait without the user. A restore that is cancelled or superseded uses this. */
    @action abandon = (): void => {
        this.skipAll();
    };

    @action private finish(choices: WorkspaceRecoveryChoice[]): void {
        if (this.isDecided) {
            return;
        }
        this.isDecided = true;
        this.resolve(choices);
    }
}
