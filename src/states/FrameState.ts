import {observable} from "mobx";
import {CARTA} from "../../protobuf/build";


export class FrameState {
    file_id: number;
    fileInfo: CARTA.FileInfo;
    fileInfoExtended: CARTA.FileInfoExtended;
    renderMode: CARTA.RenderMode;
}