import {afterEach, beforeEach, describe, expect, test} from "@jest/globals";

import {WorkspaceItemKind} from "enums";
import {WorkspaceIdRegistry} from "stores";

describe("WorkspaceIdRegistry", () => {
    const registry = WorkspaceIdRegistry.Instance;
    const reserved: number[] = [];

    /** Reserve a catalog ID, remembering the hold so that the suite can give it back. */
    function reserve(workspaceId: number) {
        registry.reserve(WorkspaceItemKind.Catalog, workspaceId);
        reserved.push(workspaceId);
    }

    beforeEach(() => {
        registry.clear(WorkspaceItemKind.Image);
        registry.clear(WorkspaceItemKind.Catalog);
    });

    afterEach(() => {
        // clear() deliberately leaves reservations alone, so a hold ends only where it was taken.
        reserved.splice(0).forEach(workspaceId => registry.releaseReservation(WorkspaceItemKind.Catalog, workspaceId));
    });

    test("gives each newly opened item the lowest ID nothing else holds", () => {
        expect(registry.register(WorkspaceItemKind.Catalog, 11)).toBe(1);
        expect(registry.register(WorkspaceItemKind.Catalog, 12)).toBe(2);
        expect(registry.workspaceIdOf(WorkspaceItemKind.Catalog, 11)).toBe(1);
        expect(registry.sessionIdOf(WorkspaceItemKind.Catalog, 2)).toBe(12);
    });

    test("keeps the ID an item already has", () => {
        expect(registry.register(WorkspaceItemKind.Catalog, 11)).toBe(1);
        expect(registry.register(WorkspaceItemKind.Catalog, 11)).toBe(1);
    });

    test("keeps images and catalogs apart", () => {
        registry.register(WorkspaceItemKind.Image, 4);
        registry.register(WorkspaceItemKind.Catalog, 9);

        expect(registry.workspaceIdOf(WorkspaceItemKind.Image, 4)).toBe(1);
        expect(registry.workspaceIdOf(WorkspaceItemKind.Catalog, 9)).toBe(1);
        expect(registry.workspaceIdOf(WorkspaceItemKind.Image, 9)).toBeUndefined();
    });

    test("takes the ID a restored workspace already knows an item by", () => {
        registry.adopt(WorkspaceItemKind.Catalog, 11, 4);

        expect(registry.workspaceIdOf(WorkspaceItemKind.Catalog, 11)).toBe(4);
        // The adopted ID is taken, so the next catalog opened cannot be handed it.
        expect(registry.register(WorkspaceItemKind.Catalog, 12)).toBe(1);
        expect(registry.register(WorkspaceItemKind.Catalog, 13)).toBe(2);
    });

    test("moves an adopted ID off whatever held it", () => {
        registry.register(WorkspaceItemKind.Catalog, 11);
        registry.adopt(WorkspaceItemKind.Catalog, 12, 1);

        expect(registry.workspaceIdOf(WorkspaceItemKind.Catalog, 12)).toBe(1);
        expect(registry.workspaceIdOf(WorkspaceItemKind.Catalog, 11)).toBeUndefined();
        expect(registry.sessionIdOf(WorkspaceItemKind.Catalog, 1)).toBe(12);
    });

    test("hands a closed item's ID to the next one opened", () => {
        registry.register(WorkspaceItemKind.Catalog, 11);
        registry.release(WorkspaceItemKind.Catalog, 11);

        expect(registry.workspaceIdOf(WorkspaceItemKind.Catalog, 11)).toBeUndefined();
        expect(registry.sessionIdOf(WorkspaceItemKind.Catalog, 1)).toBeUndefined();
        expect(registry.register(WorkspaceItemKind.Catalog, 12)).toBe(1);
    });

    test("does not hand out an ID that is reserved for an item which is not loaded", () => {
        reserve(1);
        reserve(3);

        expect(registry.register(WorkspaceItemKind.Catalog, 11)).toBe(2);
        expect(registry.register(WorkspaceItemKind.Catalog, 12)).toBe(4);
    });

    test("frees a reserved ID only once every hold on it is let go", () => {
        registry.reserve(WorkspaceItemKind.Catalog, 1);
        registry.reserve(WorkspaceItemKind.Catalog, 1);
        registry.releaseReservation(WorkspaceItemKind.Catalog, 1);

        expect(registry.register(WorkspaceItemKind.Catalog, 11)).toBe(2);

        registry.releaseReservation(WorkspaceItemKind.Catalog, 1);
        expect(registry.register(WorkspaceItemKind.Catalog, 12)).toBe(1);
    });

    test("keeps a hold that outlives the items it was taken alongside", () => {
        reserve(1);
        registry.register(WorkspaceItemKind.Catalog, 11);

        // Emptying the session forgets what was loaded. The widget that reserved ID 1 is still open
        // and still naming it, so handing 1 to the next catalog opened would move that widget onto
        // it: the hold ends when its holder gives it back, not when the session is emptied.
        registry.clear(WorkspaceItemKind.Catalog);

        expect(registry.register(WorkspaceItemKind.Catalog, 12)).toBe(2);
    });

    test("lets a restored workspace adopt an ID that was only reserved", () => {
        registry.reserve(WorkspaceItemKind.Catalog, 2);
        registry.adopt(WorkspaceItemKind.Catalog, 11, 2);

        expect(registry.workspaceIdOf(WorkspaceItemKind.Catalog, 11)).toBe(2);
        expect(registry.register(WorkspaceItemKind.Catalog, 12)).toBe(1);
    });
});
