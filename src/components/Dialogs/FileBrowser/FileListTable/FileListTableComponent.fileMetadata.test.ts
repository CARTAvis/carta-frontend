import {CARTA} from "carta-protobuf";

import {BrowserMode, FileFilteringType} from "enums";

import {FileListTableComponent, type FileListTableComponentProps} from "./FileListTableComponent";

jest.mock("stores", () => ({
    AppStore: {
        Instance: {
            preferenceStore: {
                fileFilterMode: 0
            }
        }
    },
    FileBrowserStore: {
        Instance: {
            isFileInfoResp: false
        }
    }
}));

describe("FileListTableComponent", () => {
    const defaultProps: FileListTableComponentProps = {
        darkTheme: false,
        fileList: {
            directory: "$BASE",
            parent: undefined,
            files: [],
            subdirectories: []
        },
        selectedFile: undefined,
        selectedHDU: "",
        filterType: FileFilteringType.Fuzzy,
        fileBrowserMode: BrowserMode.File,
        onSortingChanged: jest.fn(),
        onFileClicked: jest.fn(),
        onSelectionChanged: jest.fn(),
        onFileDoubleClicked: jest.fn(),
        onFolderClicked: jest.fn(),
        onListCancelled: jest.fn()
    };

    test("displays Zarr image files with a Zarr type label", () => {
        const component = new FileListTableComponent({
            ...defaultProps,
            fileList: {
                ...defaultProps.fileList,
                files: [{name: "cube.zarr", type: CARTA.FileType.ZARR, size: 1024, date: 0, HDUList: ["SKY"]}]
            }
        });

        expect(component.tableEntries).toMatchObject([
            {
                filename: "cube.zarr",
                typeInfo: {type: "Zarr", description: "Zarr Image (XRADIO Schema)"},
                hdu: "",
                isFile: true
            }
        ]);
    });

    test("lists a Zarr store with several images as one entry", () => {
        const component = new FileListTableComponent({
            ...defaultProps,
            fileList: {
                ...defaultProps.fileList,
                files: [{name: "cube.zarr", type: CARTA.FileType.ZARR, size: 1024, date: 0, HDUList: ["SKY", "FLAG_SKY"]}]
            }
        });

        expect(component.tableEntries).toHaveLength(1);
        expect(component.tableEntries[0]).toMatchObject({filename: "cube.zarr", hdu: "", isFile: true});
    });

    test("preserves the declared file size flag for image files", () => {
        const component = new FileListTableComponent({
            ...defaultProps,
            fileList: {
                ...defaultProps.fileList,
                files: [{name: "cube.zarr", type: CARTA.FileType.ZARR, size: 1024, sizeIsDeclared: true, date: 0, HDUList: ["SKY"]}]
            }
        });

        expect(component.tableEntries).toMatchObject([
            {
                filename: "cube.zarr",
                size: 1024,
                sizeIsDeclared: true
            }
        ]);
    });

    test("prefixes declared file sizes with a tilde", () => {
        expect((FileListTableComponent as any).getFileSizeDisplay(1024, true)).toBe("~1.0 kB");
        expect((FileListTableComponent as any).getFileSizeDisplay(1024, false)).toBe("1.0 kB");
    });
});
