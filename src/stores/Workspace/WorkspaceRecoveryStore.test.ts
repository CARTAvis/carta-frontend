import {WorkspaceItemKind} from "enums";

import {WorkspaceRecoveryAction, type WorkspaceRecoveryItem, WorkspaceRecoveryStore} from "./WorkspaceRecoveryStore";

const ITEM: WorkspaceRecoveryItem = {kind: WorkspaceItemKind.Image, subject: "cube.fits", message: "Could not open the image cube.fits", repointKind: "image", canRetry: false, dependents: []};

describe("WorkspaceRecoveryStore", () => {
    test("continues only when every item has a choice, and gives the choices in the order of the items", async () => {
        const recovery = new WorkspaceRecoveryStore("Opening images", [ITEM, {...ITEM, subject: "other.fits"}]);
        const location = {directory: "/moved", filename: "cube.fits"};

        recovery.setChoice(1, {action: WorkspaceRecoveryAction.Skip});
        expect(recovery.canContinue).toBe(false);
        recovery.continue();
        recovery.setChoice(0, {action: WorkspaceRecoveryAction.Repoint, location});
        expect(recovery.canContinue).toBe(true);
        recovery.continue();

        await expect(recovery.decided).resolves.toEqual([{action: WorkspaceRecoveryAction.Repoint, location}, {action: WorkspaceRecoveryAction.Skip}]);
        // The choices cannot change after the restore has them.
        recovery.setChoice(1, {action: WorkspaceRecoveryAction.Retry});
        expect(recovery.choiceOf(1)).toEqual({action: WorkspaceRecoveryAction.Skip});
        expect(recovery.canContinue).toBe(false);
    });

    test("skips every item, whatever was chosen, when the user skips all or the restore is abandoned", async () => {
        const skipped = new WorkspaceRecoveryStore("Opening catalogs", [ITEM, ITEM]);
        skipped.setChoice(0, {action: WorkspaceRecoveryAction.Retry});
        skipped.skipAll();
        await expect(skipped.decided).resolves.toEqual([{action: WorkspaceRecoveryAction.Skip}, {action: WorkspaceRecoveryAction.Skip}]);

        const abandoned = new WorkspaceRecoveryStore("Opening catalogs", [ITEM]);
        abandoned.abandon();
        await expect(abandoned.decided).resolves.toEqual([{action: WorkspaceRecoveryAction.Skip}]);
    });
});
