import Plotly from "plotly.js";

import {Point2D, TileCoordinate} from "models";
import {RasterTile, TILE_SIZE} from "services";

export class WebglSvgGenerator {
    private static readonly Float32Max = 3.402823466e38;

    // tile config
    requiredTiles: TileCoordinate[] = [];
    getTile: (encodedCoordinate: number) => RasterTile;

    // view config
    xMax: number;
    xMin: number;
    yMax: number;
    yMin: number;
    mip: number;
    rotationConfig: {rotationOrigin: Point2D; rotationAngle: number} = {rotationOrigin: {x: 0, y: 0}, rotationAngle: 0};

    // render config
    colorscaleArray: (number | string)[];
    scaleMinVal: number;
    scaleMaxVal: number;
    nanColorHex: string;

    generate = async (width: number, height: number, topPadding: number, leftPadding: number, bottomPadding: number, rightPadding: number): Promise<HTMLElement & SVGElement> => {
        const data = this.getRasterDataTrace();

        const layout = {
            autosize: false,
            width,
            height,
            margin: {
                l: leftPadding,
                r: rightPadding,
                b: bottomPadding,
                t: topPadding,
                pad: 0
            },
            xaxis: {
                range: [this.xMin, this.xMax],
                visible: false
            },
            yaxis: {
                range: [this.yMin, this.yMax],
                visible: false
            }
        };

        const url = await Plotly.toImage({data, layout}, {format: "svg", width, height} as Plotly.ToImgopts);

        const svgString = decodeURIComponent(url.split(",")[1]);
        const parser = new DOMParser();
        const svgDocument = parser.parseFromString(svgString, "image/svg+xml");
        const svgElement = svgDocument.documentElement as HTMLElement & SVGElement;

        if (this.rotationConfig.rotationAngle) {
            const heatmapGroup = svgElement.getElementsByClassName("heatmaplayer")[0];
            // TODO: slightly incorrect rotation origin?
            heatmapGroup.setAttribute("transform", `rotate(${(this.rotationConfig.rotationAngle * 180) / Math.PI} ${this.rotationConfig.rotationOrigin.x + topPadding} ${height - this.rotationConfig.rotationOrigin.y - leftPadding})`);
        }

        return svgElement;
    };

    private getRasterDataTrace = (): Plotly.Data[] => {
        let x: number[] = [];
        let y: number[] = [];
        let z: number[] = [];
        let zNan: number[] = [];
        for (const tile of this.requiredTiles) {
            const encodedCoordinate = tile.encode();
            const rasterTile = this.getTile(encodedCoordinate);
            if (!rasterTile || rasterTile.width === null || rasterTile.width === undefined) {
                continue;
            }

            const tileData = rasterTile.data;
            if (!tileData) {
                continue;
            }

            x = x.concat(Array.from({length: tileData.length}, (_, i) => (tile.x * TILE_SIZE + (i % (rasterTile.width ?? NaN))) * this.mip));
            y = y.concat(Array.from({length: tileData.length}, (_, i) => (tile.y * TILE_SIZE + Math.floor(i / (rasterTile.width ?? NaN))) * this.mip));

            for (let i = 0; i < tileData.length; i++) {
                if (tileData[i] <= -WebglSvgGenerator.Float32Max) {
                    z.push(NaN);
                    zNan.push(tileData[i]);
                } else {
                    z.push(tileData[i]);
                    zNan.push(NaN);
                }
            }
        }

        const colorscale: [number, string][] = [];
        for (let i = 0; i < this.colorscaleArray.length; i += 2) {
            colorscale.push([1.0 - (this.colorscaleArray[i] as number), this.colorscaleArray[i + 1] as string]);
        }
        colorscale.push([1, this.colorscaleArray[this.colorscaleArray.length - 1] as string]);

        const trace: Plotly.Data = {
            x,
            y,
            z,
            type: "heatmap",
            showscale: false,
            connectgaps: false,
            zmin: this.scaleMinVal,
            zmax: this.scaleMaxVal,
            colorscale
        };
        const nanTrace: Plotly.Data = {
            x,
            y,
            z: zNan,
            type: "heatmap",
            showscale: false,
            connectgaps: false,
            colorscale: [
                [0, this.nanColorHex],
                [1, this.nanColorHex]
            ]
        };

        return [trace, nanTrace];
    };
}
