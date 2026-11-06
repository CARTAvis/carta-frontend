import {beforeEach, describe, expect, test} from "@jest/globals";

import {WorkspaceItemKind} from "enums";
import {WorkspaceIdRegistry} from "stores";

describe("WorkspaceIdRegistry", () => {
    const registry = WorkspaceIdRegistry.Instance;

    beforeEach(() => {
        registry.clear(WorkspaceItemKind.Image);
        registry.clear(WorkspaceItemKind.Catalog);
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
});
