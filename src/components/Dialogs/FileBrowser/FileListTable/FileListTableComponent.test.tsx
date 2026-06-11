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
                files: [{name: "cube.zarr", type: CARTA.FileType.ZARR, size: 1024, date: 0, HDUList: ["0"]}]
            }
        });

        expect(component.tableEntries).toMatchObject([
            {
                filename: "cube.zarr",
                typeInfo: {type: "Zarr", description: "Zarr Image (XRADIO Schema)"},
                hdu: "0",
                isFile: true
            }
        ]);
    });
});
