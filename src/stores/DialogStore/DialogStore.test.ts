jest.mock("stores", () => ({
    AppStore: {Instance: {zIndexManager: {assignIndex: jest.fn(), updateIndexOnRemove: jest.fn(), updateIndexOnSelect: jest.fn()}}},
    SnippetStore: {Instance: {}}
}));

import {DialogId, FileInfoType} from "enums";

import {DialogStore} from "./DialogStore";

describe("DialogStore", () => {
    test("forgets where a dialog was when it closes, so that it opens in the middle of the window again", () => {
        const dialogStore = new DialogStore();
        dialogStore.showDialog(DialogId.Contour);
        dialogStore.setDialogGeometry(DialogId.Contour, {x: 10, y: 20, width: 600, height: 700});

        expect(dialogStore.dialogGeometries.get(DialogId.Contour)).toEqual({x: 10, y: 20, width: 600, height: 700});

        dialogStore.hideDialog(DialogId.Contour);

        expect(dialogStore.dialogGeometries.has(DialogId.Contour)).toBe(false);
    });

    test("gives the Image Fitting dialog a restored height of the fitting settings, and forgets the height when the dialog closes", () => {
        const dialogStore = new DialogStore();
        const count = dialogStore.fittingSettingsRestoreCount;

        dialogStore.restoreFittingSettingsHeight(30);

        expect(dialogStore.fittingSettingsHeight).toBe(30);
        expect(dialogStore.fittingSettingsRestoreCount).toBe(count + 1);

        dialogStore.hideDialog(DialogId.Fitting);

        expect(dialogStore.fittingSettingsHeight).toBeUndefined();
    });

    test("forgets the tab of the Contour dialog when it closes, as before, and keeps the tab of the Region dialog", () => {
        const dialogStore = new DialogStore();
        dialogStore.selectTab(DialogId.Contour, 2);
        dialogStore.selectTab(DialogId.Region, 1);

        dialogStore.hideDialog(DialogId.Contour);
        dialogStore.hideDialog(DialogId.Region);

        expect(dialogStore.selectedTabOf(DialogId.Contour)).toBeUndefined();
        expect(dialogStore.selectedTabOf(DialogId.Region)).toBe(1);
    });

    test("puts a dialog back in the middle and on its first tab before a restore applies what the workspace saved", () => {
        const dialogStore = new DialogStore();
        dialogStore.setDialogGeometry(DialogId.Region, {x: 10, y: 20, width: 600, height: 700});
        dialogStore.selectTab(DialogId.Region, 1);
        dialogStore.selectTab(DialogId.FileInfo, FileInfoType.IMAGE_FILE);

        dialogStore.resetPlaceAndTab(DialogId.Region);
        dialogStore.resetPlaceAndTab(DialogId.FileInfo);

        expect(dialogStore.dialogGeometries.has(DialogId.Region)).toBe(false);
        expect(dialogStore.selectedTabOf(DialogId.Region)).toBeUndefined();
        expect(dialogStore.selectedTabOf(DialogId.FileInfo)).toBe(FileInfoType.IMAGE_HEADER);
    });

    test("keeps the tab of each dialog, and the tab of the File Info dialog where that dialog reads it", () => {
        const dialogStore = new DialogStore();

        expect(dialogStore.selectedTabOf(DialogId.Contour)).toBeUndefined();

        dialogStore.selectTab(DialogId.Contour, 2);
        dialogStore.selectTab(DialogId.FileInfo, FileInfoType.IMAGE_FILE);

        expect(dialogStore.selectedTabOf(DialogId.Contour)).toBe(2);
        expect(dialogStore.selectedTabOf(DialogId.FileInfo)).toBe(FileInfoType.IMAGE_FILE);
        expect(dialogStore.selectedFileInfoDialogTab).toBe(FileInfoType.IMAGE_FILE);
    });
});
