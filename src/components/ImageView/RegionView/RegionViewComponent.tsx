import * as React from "react";
import {observer} from "mobx-react";
import {observable} from "mobx";
import {Group, Layer, Rect, Stage, Transformer} from "react-konva";
import {FrameStore, RegionType} from "stores";
import "./RegionViewComponent.css";
import * as Konva from "konva";
import {Point2D} from "../../../models";

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
    @observable selectedRegionRef;

    handleRef = (ref) => {
        console.log(ref);
        if (ref && this.selectedRegionRef !== ref) {
            this.selectedRegionRef = ref;
        }
    };

    handleTransform = (evt) => {
        if (evt.currentTarget && evt.currentTarget.node) {
            const anchor = evt.currentTarget.movingResizer as string;
            const node = evt.currentTarget.node() as Konva.Node;
            console.log({node, anchor});
            const nodeScale = node.scale();
            node.setAttr("scaleX", 1);
            node.setAttr("scaleY", 1);

            if (nodeScale.x <= 0 || nodeScale.y <= 0) {
                return;
            }
            const region = this.props.frame.regionSet.regions[0];
            const lb = region.controlPoints[0];
            const rt = region.controlPoints[1];
            const width = rt.x - lb.x;
            const height = rt.y - lb.y;
            let newRT = {x: rt.x, y: rt.y};
            let newLB = {x: lb.x, y: lb.y};
            // X anchors are switched due to rotation
            if (anchor.indexOf("left") >= 0) {
                newRT.x = lb.x + width * nodeScale.x;
            } else if (anchor.indexOf("right") >= 0) {
                newLB.x = rt.x - width * nodeScale.x;
            }

            if (anchor.indexOf("top") >= 0) {
                newRT.y = lb.y + height * nodeScale.y;
            } else if (anchor.indexOf("bottom") >= 0) {
                newLB.y = rt.y - height * nodeScale.y;
            }


            region.setControlPoints([newLB, newRT]);
        }
    };

    render() {

        const frame = this.props.frame;
        const regionSet = frame.regionSet;

        let className = "region-stage";
        if (this.props.docked) {
            className += " docked";
        }

        const currentView = frame.requiredFrameView;
        let regionRects = null;

        if (regionSet && regionSet.regions.length) {
            regionRects = regionSet.regions.filter(r => r.regionType === RegionType.RECTANGLE && r.isValid).map((r, index) => {
                const lbImageSpace = r.controlPoints[0];
                const rtImageSpace = r.controlPoints[1];
                const viewWidth = currentView.xMax - currentView.xMin;
                const viewHeight = currentView.yMax - currentView.yMin;

                const lb = {x: Math.floor((lbImageSpace.x - currentView.xMin) / viewWidth * this.props.width), y: Math.floor((lbImageSpace.y - currentView.yMin) / viewHeight * this.props.height)};
                const rt = {x: Math.floor((rtImageSpace.x - currentView.xMin) / viewWidth * this.props.width), y: Math.floor((rtImageSpace.y - currentView.yMin) / viewHeight * this.props.height)};
                const width = Math.floor(Math.abs(rt.x - lb.x));
                const height = Math.floor(Math.abs(rt.y - lb.y));
                return (
                    <Group key={index}>
                        <Rect rotation={180} x={rt.x + 0.5} y={rt.y + 0.5} width={width} height={height} key={index} stroke={"white"} strokeWidth={2} draggable={true} fillEnabled={false} ref={this.handleRef}/>
                        <Rect rotation={180} x={rt.x + 0.5 + 1} y={rt.y + 0.5 + 1} width={width + 2} height={height + 2} stroke={"black"} strokeWidth={1} fillEnabled={false} strokeHitEnabled={false}/>
                        <Rect rotation={180} x={rt.x + 0.5 - 1} y={rt.y + 0.5 - 1} width={width - 2} height={height - 2} stroke={"black"} strokeWidth={1} fillEnabled={false} strokeHitEnabled={false}/>
                    </Group>
                );
            });
        }
        return (
            <Stage className={className} width={this.props.width} height={this.props.height} style={{left: this.props.left, top: this.props.top}}>
                <Layer scaleY={-1} offsetY={this.props.height}>
                    {regionRects}
                    {this.selectedRegionRef &&
                    <Transformer node={this.selectedRegionRef} visible={true} onTransform={this.handleTransform} onTransformEnd={() => console.log("transform finished")}/>
                    }
                </Layer>
            </Stage>
        );
    }
}