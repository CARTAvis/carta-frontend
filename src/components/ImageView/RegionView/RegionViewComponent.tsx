import * as React from "react";
import {Layer, Rect, Stage} from "react-konva";
import {FrameStore, RegionType} from "stores";
import "./RegionViewComponent.css";

export interface RegionViewComponentProps {
    frame: FrameStore;
    docked: boolean;
    width: number;
    height: number;
    left: number;
    top: number;
}

export class RegionViewComponent extends React.Component<RegionViewComponentProps> {
    render() {

        const frame = this.props.frame;
        const regionSet = frame.regionSet;

        let className = "region-stage";
        if (this.props.docked) {
            className += " docked";
        }


        let regionRects = null;
        if (regionSet && regionSet.regions.length) {
            regionRects = regionSet.regions.filter(r => r.regionType === RegionType.RECTANGLE && r.isValid).map((r, index) => {
                const lb = r.controlPoints[0];
                const rt = r.controlPoints[1];
                const center = {x: (lb.x + rt.x) / 2.0, y: (lb.y + rt.y) / 2.0};
                const width = Math.abs(rt.x - lb.x);
                const height = Math.abs(rt.y - lb.y);
                return <Rect x={center.x} y={center.y} width={width} height={height} key={index} stroke={"red"} strokeWidth={1}/>;
            });
        }

        return (
            <Stage className={className} width={this.props.width} height={this.props.height} style={{left: this.props.left, top: this.props.top}}>
                <Layer>
                    {regionRects}
                </Layer>
            </Stage>
        );
    }
}