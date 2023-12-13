import {FloatingObjzIndexManager} from "./zindex";

describe("FloatingObjzIndexManager returns expected z indexes", () => {
    test("zIndex", () => {
        let zIndexManager = new FloatingObjzIndexManager();

        // test methods assignIndex, floatingObjsNum and findIndex by adding four objects
        const mockObjsId = ["testId1", "testId2", "testId3", "testId4"];
        mockObjsId.forEach(w => zIndexManager.assignIndex(w));

        expect(zIndexManager.floatingObjsNum).toBe(mockObjsId.length);
        let expectzIndex = [1, 2, 3, 4];
        for (let i = 0; i < mockObjsId.length; i++) {
            expect(zIndexManager.findIndex(mockObjsId[i])).toBe(expectzIndex[i]);
        }

        // test updating zIndex array with two sequent object selecting
        zIndexManager.updateIndexOnSelect("testId3");
        expectzIndex = [1, 2, 4, 3];
        for (let i = 0; i < mockObjsId.length; i++) {
            expect(zIndexManager.findIndex(mockObjsId[i])).toBe(expectzIndex[i]);
        }

        zIndexManager.updateIndexOnSelect("testId2");
        expectzIndex = [1, 4, 3, 2];
        for (let i = 0; i < mockObjsId.length; i++) {
            expect(zIndexManager.findIndex(mockObjsId[i])).toBe(expectzIndex[i]);
        }

        // test removing object
        zIndexManager.updateIndexOnRemove("testId4");
        zIndexManager.removeIndex("testId4");
        expect(zIndexManager.floatingObjsNum).toBe(mockObjsId.length - 1);
        expect(zIndexManager.findIndex("testId1")).toBe(1);
        expect(zIndexManager.findIndex("testId2")).toBe(3);
        expect(zIndexManager.findIndex("testId3")).toBe(2);
    });
});
