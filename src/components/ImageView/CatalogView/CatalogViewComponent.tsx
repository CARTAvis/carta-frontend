import {observer} from "mobx-react";
import * as React from "react";
import {AppStore, OverlayStore} from "stores";
import {imageToCanvasPos} from "../RegionView/shared";
import "./CatalogViewComponent.css";

export interface CatalogViewComponentProps {
    overlaySettings: OverlayStore;
    appStore: AppStore;
    docked: boolean;
}

@observer
export class CatalogViewComponent extends React.Component<CatalogViewComponentProps> {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;

    componentDidMount() {
        this.ctx = this.canvas.getContext("2d");
    }

    componentDidUpdate() {
        requestAnimationFrame(this.updateCanvas);
    }

    private resizeAndClearCanvas() {
        const frame = this.props.appStore.activeFrame;
        if (!frame) {
            return;
        }

        const reqWidth = Math.max(1, frame.renderWidth * devicePixelRatio);
        const reqHeight = Math.max(1, frame.renderHeight * devicePixelRatio);
        // Resize canvas if necessary
        if (this.canvas.width !== reqWidth || this.canvas.height !== reqHeight) {
            this.canvas.width = reqWidth;
            this.canvas.height = reqHeight;
        } else {
            // Otherwise just clear it
            this.ctx.clearRect(0, 0, reqWidth, reqHeight);
        }
    }

    private updateCanvas = () => {
        const catalogStore = this.props.appStore.catalogStore;
        const frame = this.props.appStore.activeFrame;

        this.resizeAndClearCanvas();

        if (frame && catalogStore) {
            const width = frame.renderWidth;
            const height = frame.renderHeight;
            catalogStore.catalogs.forEach((set, key) => {
                this.ctx.strokeStyle = set.color;
                this.ctx.save();
                this.ctx.scale(devicePixelRatio, devicePixelRatio);
                // Use two control points to determine shift and scaling transforms, rather than converting each point
                // Note, this may have a single-pixel (canvas or image space) offset...
                const zeroPoint = imageToCanvasPos(0, 0, frame.requiredFrameView, width, height);
                const onePoint = imageToCanvasPos(1, 1, frame.requiredFrameView, width, height);
                const scale = onePoint.x - zeroPoint.x;
                this.ctx.scale(scale, scale);
                const shapeSize = set.size / scale;
                this.ctx.lineWidth = 1.0 / scale;
                this.ctx.translate(zeroPoint.x / scale, zeroPoint.y / scale);
                this.ctx.scale(1, -1);
                // This approach assumes all points have the same color, so the stroke can be batched
                this.ctx.beginPath();
                for (const arr of set.pixelData) {
                    for (const point of arr) {
                        this.ctx.moveTo(point.x + shapeSize, point.y);
                        this.ctx.arc(point.x, point.y, shapeSize, 0, 2 * Math.PI);
                    }
                }
                this.ctx.stroke();
                this.ctx.restore();
            });
        }
    };

    render() {
        // dummy values to trigger React's componentDidUpdate()
        const frame = this.props.appStore.activeFrame;
        const catalogStore = this.props.appStore.catalogStore;
        if (frame) {
            const catalogs = catalogStore.catalogs;
            const view = frame.requiredFrameView;
            catalogs.forEach(catalogSettings => {
                const color = catalogSettings.color;
                const size = catalogSettings.size;
                let total = 0;
                for (const arr of catalogSettings.pixelData) {
                    total += arr.length;
                }
            });
        }
        const padding = this.props.overlaySettings.padding;
        let className = "catalog-div";
        if (this.props.docked) {
            className += " docked";
        }
        return (
            <div className={className}>
                <canvas
                    id="catalog-canvas"
                    className="catalog-canvas"
                    ref={(ref) => this.canvas = ref}
                    style={{
                        top: padding.top,
                        left: padding.left,
                        width: frame ? frame.renderWidth || 1 : 1,
                        height: frame ? frame.renderHeight || 1 : 1
                    }}
                />
            </div>);
    }
}