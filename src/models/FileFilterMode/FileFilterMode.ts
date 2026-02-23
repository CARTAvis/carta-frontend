import {CARTA} from "carta-protobuf";

import {FileFilterMode} from "enums";

export function ToFileListFilterMode(mode: FileFilterMode): CARTA.FileListFilterMode {
    switch (mode) {
        case FileFilterMode.Content:
            return CARTA.FileListFilterMode.Content;
        case FileFilterMode.Extension:
            return CARTA.FileListFilterMode.Extension;
        default:
            return CARTA.FileListFilterMode.AllFiles;
    }
}
