import {observer} from "mobx-react";
import * as React from "react";
import {Group, Layer, Ring, Stage} from "react-konva";
import {AppStore, OverlayStore} from "stores";
import {imageToCanvasPos} from "../RegionView/shared";
import {Point2D} from "models";
import "./CatalogViewComponent.css";

export interface CatalogViewComponentProps {
    overlaySettings: OverlayStore;
    appStore: AppStore;
    docked: boolean;
}

@observer
export class CatalogViewComponent extends React.Component<CatalogViewComponentProps> {
    private infinity = 1.7976931348623157e+308;
    private catalogs = [];

    private genCircle(id: string, color: string, valueCanvasSpaceX: number, valueCanvasSpaceY: number, scale: number, radius: number) {
        let innerRadius = radius * scale;
        let outerRadius = (radius + 1) * scale;
        return (
            <Group key={id} x={valueCanvasSpaceX} y={valueCanvasSpaceY}>
                <Ring innerRadius={innerRadius} outerRadius={outerRadius} fill={color}/>
            </Group>
        );
    }

    // ignore point outof current sky
    private infinityPoint(point: Point2D): boolean {
        if (point.x === this.infinity || point.x === -this.infinity || point.y === this.infinity || point.y === -this.infinity) {
            return true;
        }
        return false;
    }

    private addCatalogs() {
        const catalogStore = this.props.appStore.catalogStore;
        const frame = this.props.appStore.activeFrame;
        this.catalogs = [];
        const width = frame ? frame.renderWidth || 1 : 1;
        const height = frame ? frame.renderHeight || 1 : 1;
        if (catalogStore) {
            catalogStore.catalogs.forEach((value, key) => {
                for (let i = 0; i < value.pixelData.length; i++) {
                    const pointArray = value.pixelData[i];
                    for (let j = 0; j < pointArray.length; j++) {
                        const point = pointArray[j];
                        if (!this.infinityPoint(point)) {
                            const id = key + "-" + i + "-" + j;
                            const currentCenterPixelSpace = imageToCanvasPos(point.x - 1, point.y - 1, frame.requiredFrameView, width, height);
                            this.catalogs.push(this.genCircle(id, value.color, currentCenterPixelSpace.x, currentCenterPixelSpace.y, 1, value.size));  
                        }
                    }
                }
            });
        }
    }

    render() {
        const frame = this.props.appStore.activeFrame;
        const width = frame ? frame.renderWidth || 1 : 1;
        const height = frame ? frame.renderHeight || 1 : 1;
        if (frame) {
            this.addCatalogs();
        }
        const padding = this.props.overlaySettings.padding;
        let className = "catalog-div";
        if (this.props.docked) {
            className += " docked";
        }
        return (
            <Stage
                className={className}
                width={width}
                height={height}
                style={{
                    left: padding.left, 
                    top: padding.top
                }}
                x={0}
                y={0}
            >
                <Layer 
                    className="catalog-layer"
                    style={{
                        top: padding.top,
                        left: padding.left,
                        width: width,
                        height: height
                    }}
                >
                    {this.catalogs}
                </Layer>
            </Stage>
        );
    }
}