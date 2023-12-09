import {FloatingObjzIndexManager} from "./zindex";

describe("zIndexManager", () => {
    test("return expected zIndex order", () => {
        let zIndexManager = new FloatingObjzIndexManager();

        // test methods assignIndex, getFloatingObjs and findIndex by adding four objects
        const mockObjsId = ["testId1", "testId2", "testId3", "testId4"];
        mockObjsId.forEach(w => zIndexManager.assignIndex(w));

        expect(zIndexManager.getFloatingObjs().size).toBe(mockObjsId.length);
        let expectOrder = [1, 2, 3, 4];
        for (let i = 0; i < mockObjsId.length; i++) {
            expect(zIndexManager.findIndex(mockObjsId[i])).toBe(expectOrder[i]);
        }

        // test updating zIndex array with two sequent object selecting
        zIndexManager.updateIndexOnSelect("testId3");
        expectOrder = [1, 2, 4, 3];
        for (let i = 0; i < mockObjsId.length; i++) {
            expect(zIndexManager.findIndex(mockObjsId[i])).toBe(expectOrder[i]);
        }

        zIndexManager.updateIndexOnSelect("testId2");
        expectOrder = [1, 4, 3, 2];
        for (let i = 0; i < mockObjsId.length; i++) {
            expect(zIndexManager.findIndex(mockObjsId[i])).toBe(expectOrder[i]);
        }

        // test removing object
        zIndexManager.updateIndexOnRemove("testId4");
        zIndexManager.removeIndex("testId4");
        expect(zIndexManager.getFloatingObjs().size).toBe(mockObjsId.length - 1);
        expect(zIndexManager.findIndex("testId1")).toBe(1);
        expect(zIndexManager.findIndex("testId2")).toBe(3);
        expect(zIndexManager.findIndex("testId3")).toBe(2);
    });
});
