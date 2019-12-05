import {action, computed, observable} from "mobx";
import {Colors} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import {RegionWidgetStore} from "./RegionWidgetStore";

const DEFAULTS = {
        fractionalPolVisible: false,
        useWcsValues: true,
        scatterOutRangePointsZIndex: [],
        primaryLineColor: { colorHex: Colors.BLUE2, fixed: false },
        secondaryLineColor: { colorHex: Colors.ORANGE2, fixed: false },
        lineWidth: 1,
        linePlotPointSize: 1.5,
        scatterPlotPointSize: 3,
        equalAxes: true,
        colorMap: "jet",
        pointTransparency: 1
};

export class CatalogOverlayWidgetStore extends RegionWidgetStore {
    @observable channel: number;
    @observable progress: number;
    @observable numGeneratedVertices: number[];
    @observable vertexCount: number = 0;
    @observable chunkCount: number = 0;

    private indexOffsets: Int32Array[];
    private vertexData: Float32Array[];
    private vertexBuffers: WebGLBuffer[];

    catalogFackHeader = [{name: "RA", colIndex: 0, type: "int", typeIndex: 0},
                        {name: "DEC", colIndex: 1, type: "int", typeIndex: 1},
                        {name: "Description", colIndex: 2, type: "string", typeIndex: 2}
                    ];
    catalogFackData = {intColums: [[1 , 2, 3, 4, 5, 6, 7], [1 , 2, 3, 4, 5, 6, 7]],
                    floatColums: [[0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7]],
                    stringColums: [[]],
                    boolColums: [[]]
    };

    private gl: WebGLRenderingContext;
    // Number of vertex data "float" values (normals are actually int16, so both coordinates count as one 32-bit value)
    // Each vertex is repeated twice
    private static VertexDataElements = 8;
    // settings 

    @action setChannel = (channel: number) => {
        this.channel = channel;
    };

    constructor() {
        super();
    }
}