import * as React from "react";
import {observer} from "mobx-react";
import {Layer, Stage, Text} from "react-konva";
import {FrameStore, RegionStore, RegionType} from "stores";
import "./RegionViewComponent.css";
import {RectangularRegionComponent} from "./RectangularRegionComponent";
import * as Konva from "konva";

export interface RegionViewComponentProps {
    frame: FrameStore;
    docked: boolean;
    width: number;
    height: number;
    left: number;
    top: number;
}

@observer
export class RegionViewComponent extends React.Component<RegionViewComponentProps> {

    handleClick = (konvaEvent) => {
        if (konvaEvent.target.nodeType !== "Stage" && (konvaEvent.evt.button === 0 || konvaEvent.evt.button === 2)) {
            console.log("ignoring handled event");
            return;
        }

        console.log("stage click event");
    };

    render() {

        const frame = this.props.frame;
        const regionSet = frame.regionSet;

        let className = "region-stage";
        if (this.props.docked) {
            className += " docked";
        }

        let regionRects = null;

        if (regionSet && regionSet.regions.length) {
            regionRects = regionSet.regions.filter(r => r.regionType === RegionType.RECTANGLE && r.isValid).map(
                r => <RectangularRegionComponent key={r.regionId} region={r} frame={frame} layerWidth={this.props.width} layerHeight={this.props.height} selected={r === regionSet.selectedRegion} onSelect={regionSet.selectRegion}/>
            );
        }
        return (
            <Stage className={className} width={this.props.width} height={this.props.height} style={{left: this.props.left, top: this.props.top}} onClick={this.handleClick}>
                <Layer>
                    <Text x={300} y={300} text={"Testing text"} fill={"red"}/>
                    {regionRects}

                </Layer>
            </Stage>
        );
    }
}