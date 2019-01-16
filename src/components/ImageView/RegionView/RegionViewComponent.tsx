import * as React from "react";
import * as Konva from "konva";
import {observer} from "mobx-react";
import {observable} from "mobx";
import {Group, Layer, Rect, Stage, Transformer, Text} from "react-konva";
import {FrameStore, RegionType} from "stores";
import "./RegionViewComponent.css";

export interface RegionViewComponentProps {
    frame: FrameStore;
    docked: boolean;
    centeredScaling: boolean;
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
            const region = this.props.frame.regionSet.regions[0];

            if (anchor.indexOf("rotater") >= 0) {
                // handle rotation
                const rotation = node.rotation();
                node.setAttr("rotation", 0);
                region.setRotation(rotation);
            } else {
                // handle scaling
                const nodeScale = node.scale();
                node.setAttr("scaleX", 1);
                node.setAttr("scaleY", 1);

                if (nodeScale.x <= 0 || nodeScale.y <= 0) {
                    return;
                }

                if (this.props.centeredScaling) {
                    const newWidth = region.controlPoints[1].x * nodeScale.x;
                    const newHeight = region.controlPoints[1].y * nodeScale.y;
                    region.setControlPoint(1, {x: newWidth, y: newHeight});
                } else {
                    console.log({anchor, node, target: evt.currentTarget});
                    const newWidth = region.controlPoints[1].x * nodeScale.x;
                    const newHeight = region.controlPoints[1].y * nodeScale.y;
                    const deltaWidth = newWidth - region.controlPoints[1].x;
                    const deltaHeight = newHeight - region.controlPoints[1].y;
                    let center = {x: region.controlPoints[0].x, y: region.controlPoints[0].y};
                    if (anchor.indexOf("left") >= 0) {
                        center.x -= deltaWidth / 2.0;
                    } else if (anchor.indexOf("right") >= 0) {
                        center.x += deltaWidth / 2.0;
                    }
                    region.setControlPoints([center, {x: newWidth, y: newHeight}]);
                }
                // const lb = region.controlPoints[0];
                // const rt = region.controlPoints[1];
                // const width = rt.x - lb.x;
                // const height = rt.y - lb.y;
                // let newRT = {x: rt.x, y: rt.y};
                // let newLB = {x: lb.x, y: lb.y};
                // // X anchors are switched due to rotation
                // if (anchor.indexOf("left") >= 0) {
                //     newRT.x = lb.x + width * nodeScale.x;
                // } else if (anchor.indexOf("right") >= 0) {
                //     newLB.x = rt.x - width * nodeScale.x;
                // }
                //
                // if (anchor.indexOf("top") >= 0) {
                //     newRT.y = lb.y + height * nodeScale.y;
                // } else if (anchor.indexOf("bottom") >= 0) {
                //     newLB.y = rt.y - height * nodeScale.y;
                // }
                //
                // region.setControlPoints([newLB, newRT]);
            }
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
                const cxImageSpace = r.controlPoints[0];
                const viewWidth = currentView.xMax - currentView.xMin;
                const viewHeight = currentView.yMax - currentView.yMin;

                const center = {x: Math.floor((cxImageSpace.x - currentView.xMin) / viewWidth * this.props.width), y: this.props.height - Math.ceil((cxImageSpace.y - currentView.yMin) / viewHeight * this.props.height)};
                const width = Math.floor(r.controlPoints[1].x * frame.zoomLevel);
                const height = Math.floor(r.controlPoints[1].y * frame.zoomLevel);
                return (
                    <Group key={index}>
                        <Rect
                            rotation={r.rotation}
                            x={center.x + 0.5}
                            y={center.y + 0.5}
                            width={width}
                            height={height}
                            offsetX={width / 2.0}
                            offsetY={height / 2.0}
                            key={index}
                            stroke={"white"}
                            strokeWidth={1}
                            draggable={true}
                            fillEnabled={false}
                            ref={this.handleRef}
                        />
                    </Group>
                );
            });
        }
        return (
            <Stage className={className} width={this.props.width} height={this.props.height} style={{left: this.props.left, top: this.props.top}}>
                <Layer>
                    <Text x={300} y={300} text={"Testing text"} fill={"red"}/>
                    {regionRects}
                    {this.selectedRegionRef &&
                    <Transformer
                        node={this.selectedRegionRef}
                        rotateAnchorOffset={20}
                        keepRatio={false}
                        centeredScaling={this.props.centeredScaling}
                        onTransform={this.handleTransform}
                        onTransformEnd={() => console.log("transform finished")}
                    />
                    }
                </Layer>
            </Stage>
        );
    }
}