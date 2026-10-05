import {CARTA} from "carta-protobuf";
import Long from "long";
import type {BrowserFileList} from "stores";

import {BrowserMode, FileFilteringType} from "enums";

import {FileListTableComponent, type FileListTableComponentProps} from "./FileListTableComponent";

// 64-bit protobuf fields (size, date) arrive as Long objects; the example sizes come from issue #2859,
// where string comparison of the digits orders them 75 MB < 8.0 GB < 9 kB
const KB_9 = 9e3;
const MB_75 = 75e6;
const GB_8 = 8e9;

const MakeImageFileList = (): BrowserFileList => ({
    directory: "/images",
    parent: "/",
    subdirectories: [
        {name: "dir_c", itemCount: 3, date: Long.fromNumber(1_700_000_000)},
        {name: "dir_a", itemCount: 1, date: Long.fromNumber(1_600_000_000)},
        {name: "dir_b", itemCount: 2, date: Long.fromNumber(1_650_000_000)}
    ],
    files: [
        {name: "large.fits", type: CARTA.FileType.FITS, size: Long.fromNumber(GB_8), date: Long.fromNumber(1_600_000_000), HDUList: ["0"]},
        {name: "small.fits", type: CARTA.FileType.FITS, size: Long.fromNumber(KB_9), date: Long.fromNumber(1_700_000_000), HDUList: ["0"]},
        {name: "medium.fits", type: CARTA.FileType.FITS, size: Long.fromNumber(MB_75), date: Long.fromNumber(1_650_000_000), HDUList: ["0"]}
    ]
});

const MakeCatalogFileList = (): BrowserFileList => ({
    directory: "/catalogs",
    parent: "/",
    subdirectories: [],
    files: [
        {name: "large.xml", type: CARTA.CatalogFileType.VOTable, fileSize: Long.fromNumber(GB_8), date: Long.fromNumber(1_600_000_000)},
        {name: "small.xml", type: CARTA.CatalogFileType.VOTable, fileSize: Long.fromNumber(KB_9), date: Long.fromNumber(1_700_000_000)},
        {name: "medium.xml", type: CARTA.CatalogFileType.VOTable, fileSize: Long.fromNumber(MB_75), date: Long.fromNumber(1_650_000_000)}
    ]
});

const MakeComponent = (fileList: BrowserFileList, sortingString: string, fileBrowserMode: BrowserMode = BrowserMode.File) => {
    const props: FileListTableComponentProps = {
        darkTheme: false,
        fileList,
        selectedFile: null,
        selectedHDU: "",
        filterType: FileFilteringType.Fuzzy,
        sortingString,
        fileBrowserMode,
        onSortingChanged: jest.fn(),
        onFileClicked: jest.fn(),
        onSelectionChanged: jest.fn(),
        onFileDoubleClicked: jest.fn(),
        onFolderClicked: jest.fn(),
        onListCancelled: jest.fn()
    };
    return new FileListTableComponent(props);
};

describe("FileListTableComponent sorting", () => {
    it("sorts image files by numerical size, not by the leading digit", () => {
        const ascending = MakeComponent(MakeImageFileList(), "+size").tableEntries.filter(entry => entry.isFile);
        expect(ascending.map(entry => entry.filename)).toEqual(["small.fits", "medium.fits", "large.fits"]);
        expect(ascending.map(entry => entry.size)).toEqual([KB_9, MB_75, GB_8]);

        const descending = MakeComponent(MakeImageFileList(), "-size").tableEntries.filter(entry => entry.isFile);
        expect(descending.map(entry => entry.filename)).toEqual(["large.fits", "medium.fits", "small.fits"]);
    });

    it("sorts across all size units (B, kB, MB, GB, TB) by the raw byte count", () => {
        // display strings would order these as 1.20 TB < 1.8 GB < 2 B < 250.0 kB < 900.0 GB < 95.5 MB
        const sizes = [1.2e12, 1.8e9, 2, 250e3, 900e9, 95.5e6];
        const fileList: BrowserFileList = {
            directory: "/images",
            parent: "/",
            subdirectories: [],
            files: sizes.map((size, index) => ({name: `file${index}.fits`, type: CARTA.FileType.FITS, size: Long.fromNumber(size), date: Long.fromNumber(0), HDUList: ["0"]}))
        };
        const ascending = MakeComponent(fileList, "+size").tableEntries;
        expect(ascending.map(entry => entry.size)).toEqual([2, 250e3, 95.5e6, 1.8e9, 900e9, 1.2e12]);
        const descending = MakeComponent(fileList, "-size").tableEntries;
        expect(descending.map(entry => entry.size)).toEqual([1.2e12, 900e9, 1.8e9, 95.5e6, 250e3, 2]);
    });

    it("sorts catalog files by numerical size", () => {
        const ascending = MakeComponent(MakeCatalogFileList(), "+size", BrowserMode.Catalog).tableEntries;
        expect(ascending.map(entry => entry.filename)).toEqual(["small.xml", "medium.xml", "large.xml"]);
        expect(ascending.map(entry => entry.size)).toEqual([KB_9, MB_75, GB_8]);

        const descending = MakeComponent(MakeCatalogFileList(), "-size", BrowserMode.Catalog).tableEntries;
        expect(descending.map(entry => entry.filename)).toEqual(["large.xml", "medium.xml", "small.xml"]);
    });

    it("sorts directories by item count and keeps them ahead of files", () => {
        const entries = MakeComponent(MakeImageFileList(), "+size").tableEntries;
        expect(entries.slice(0, 3).map(entry => entry.filename)).toEqual(["dir_a", "dir_b", "dir_c"]);
        expect(entries.slice(0, 3).every(entry => entry.isDirectory)).toBe(true);
    });

    it("sorts files and directories by numerical date", () => {
        const ascending = MakeComponent(MakeImageFileList(), "+date").tableEntries;
        expect(ascending.map(entry => entry.filename)).toEqual(["dir_a", "dir_b", "dir_c", "large.fits", "medium.fits", "small.fits"]);
        expect(ascending.map(entry => entry.date)).toEqual([1_600_000_000, 1_650_000_000, 1_700_000_000, 1_600_000_000, 1_650_000_000, 1_700_000_000]);

        const descending = MakeComponent(MakeImageFileList(), "-date").tableEntries;
        expect(descending.map(entry => entry.filename)).toEqual(["dir_c", "dir_b", "dir_a", "small.fits", "medium.fits", "large.fits"]);
    });

    it("converts Long sizes and dates to plain numbers in the table entries", () => {
        const entries = MakeComponent(MakeImageFileList(), "+filename").tableEntries;
        for (const entry of entries) {
            expect(typeof entry.date).toBe("number");
            if (entry.isFile) {
                expect(typeof entry.size).toBe("number");
            }
        }
    });
});
