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
    private infinity = 1.7976931348623157e+308;
    private catalogs = [];
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
                this.ctx.lineWidth = devicePixelRatio;
                this.ctx.resetTransform();
                this.ctx.scale(devicePixelRatio, devicePixelRatio);
                // This approach assumes all points have the same color, so the stroke can be batched
                this.ctx.beginPath();
                for (const arr of set.pixelData) {
                    for (const point of arr) {
                        const currentCenterPixelSpace = imageToCanvasPos(point.x - 1, point.y - 1, frame.requiredFrameView, width, height);
                        this.ctx.moveTo(currentCenterPixelSpace.x + set.size, currentCenterPixelSpace.y);
                        this.ctx.arc(currentCenterPixelSpace.x, currentCenterPixelSpace.y, set.size, 0, 2 * Math.PI);
                    }
                }
                this.ctx.stroke();
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