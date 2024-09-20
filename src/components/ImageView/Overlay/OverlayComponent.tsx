import * as React from "react";
import * as AST from "ast_wrapper";
import classNames from "classnames";
import * as _ from "lodash";
import {observer} from "mobx-react";

import {CursorInfo, ImageItem, ImageType, SPECTRAL_TYPE_STRING} from "models";
import {AppStore, OverlayStore, PreferenceStore} from "stores";

import "./OverlayComponent.scss";

export class OverlayComponentProps {
    overlaySettings: OverlayStore;
    image: ImageItem;
    docked: boolean;
    onClicked?: (cursorInfo: CursorInfo) => void;
    onZoomed?: (cursorInfo: CursorInfo, delta: number) => void;
}

@observer
export class OverlayComponent extends React.Component<OverlayComponentProps> {
    canvas: HTMLCanvasElement;

    componentDidMount() {
        if (this.canvas) {
            if (PreferenceStore.Instance.limitOverlayRedraw) {
                this.throttledRenderCanvas();
            } else {
                requestAnimationFrame(this.renderCanvas);
            }
        }
    }

    componentDidUpdate() {
        AppStore.Instance.resetImageRatio();
        if (PreferenceStore.Instance.limitOverlayRedraw) {
            this.throttledRenderCanvas();
        } else {
            requestAnimationFrame(this.renderCanvas);
        }
    }

    updateImageDimensions() {
        if (this.canvas) {
            const frame = this.props.image?.type === ImageType.COLOR_BLENDING ? this.props.image.store?.baseFrame : this.props.image?.store;
            this.canvas.width = (frame?.isPreview ? frame?.previewViewWidth : this.props.overlaySettings.viewWidth) * devicePixelRatio * AppStore.Instance.imageRatio;
            this.canvas.height = (frame?.isPreview ? frame?.previewViewHeight : this.props.overlaySettings.viewHeight) * devicePixelRatio * AppStore.Instance.imageRatio;
        }
    }

    renderCanvas = () => {
        this.updateImageDimensions();
        this.props.overlaySettings.plot(this.canvas?.getContext("2d"), this.canvas?.height, this.props.image);
    };

    throttledRenderCanvas = _.throttle(this.renderCanvas, 50);

    private getRef = ref => {
        this.canvas = ref;
    };

    render() {
        const frame = this.props.image?.type === ImageType.COLOR_BLENDING ? this.props.image.store?.baseFrame : this.props.image?.store;
        const refFrame = frame.spatialReference ?? frame;
        // changing the frame view, padding or width/height triggers a re-render

        const w = frame?.isPreview ? frame?.previewViewWidth : this.props.overlaySettings.viewWidth;
        const h = frame?.isPreview ? frame?.previewViewHeight : this.props.overlaySettings.viewHeight;

        // Dummy variables for triggering re-render
        /* eslint-disable no-unused-vars, @typescript-eslint/no-unused-vars */
        const styleString = this.props.overlaySettings.styleString;
        const frameView = refFrame.requiredFrameView;
        const framePadding = this.props.overlaySettings.padding;
        const moving = frame.moving;
        const system = this.props.overlaySettings.global.system;
        const globalColor = this.props.overlaySettings.global.color;
        const titleColor = this.props.overlaySettings.title.color;
        const gridColor = this.props.overlaySettings.grid.color;
        const borderColor = this.props.overlaySettings.border.color;
        const oticksColor = this.props.overlaySettings.ticks.color;
        const axesColor = this.props.overlaySettings.axes.color;
        const numbersColor = this.props.overlaySettings.numbers.color;
        const labelsColor = this.props.overlaySettings.labels.color;
        const darktheme = AppStore.Instance.darkTheme;
        const title = this.props.overlaySettings.title.customText ? this.props.image?.store?.titleCustomText : this.props.image?.store?.filename;
        const ratio = AppStore.Instance.imageRatio;
        const titleStyleString = this.props.overlaySettings.title.styleString;
        const gridStyleString = this.props.overlaySettings.grid.styleString;
        const borderStyleString = this.props.overlaySettings.border.styleString;
        const ticksStyleString = this.props.overlaySettings.ticks.styleString;
        const axesStyleString = this.props.overlaySettings.axes.styleString;
        const numbersStyleString = this.props.overlaySettings.numbers.styleString;
        const labelsStyleString = this.props.overlaySettings.labels.styleString;
        const offsetCoord = frame.isOffsetCoord;
        const offsetWcs = frame.wcsInfoShifted;

        if (frame.isSwappedZ) {
            const requiredChannel = frame.requiredChannel;
        }
        /* eslint-enable no-unused-vars, @typescript-eslint/no-unused-vars */

        // Trigger switching AST overlay axis for PV image
        const spectralAxisSetting =
            `${frame.spectralType ? `System(${frame.spectral})=${frame.spectralType},` : ""}` +
            `${frame.spectralUnit ? `Unit(${frame.spectral})=${frame.spectralUnit},` : ""}` +
            `${frame.spectralSystem ? `StdOfRest=${frame.spectralSystem},` : ""}` +
            `${frame.restFreqStore.restFreqInHz ? `RestFreq=${frame.restFreqStore.restFreqInHz} Hz,` : ""}` +
            `${frame.spectralType && frame.spectralSystem ? `Label(${frame.spectral})=[${frame.spectralSystem}] ${SPECTRAL_TYPE_STRING.get(frame.spectralType)},` : ""}`;

        const dirAxesSetting = `${frame.dirX > 2 || frame.dirXLabel === "" ? "" : `Label(${frame.dirX})=${frame.dirXLabel},`} ${frame.dirY > 2 || frame.dirYLabel === "" ? "" : `Label(${frame.dirY})=${frame.dirYLabel},`}`;

        if (frame.isPVImage && frame.spectralAxis?.valid) {
            AST.set(frame.wcsInfo, spectralAxisSetting);
        } else if (frame.isSwappedZ && frame.spectralAxis?.valid) {
            AST.set(frame.wcsInfo, spectralAxisSetting + dirAxesSetting);
        } else {
            const formatStringX = this.props.overlaySettings.numbers.formatStringX;
            const formatStyingY = this.props.overlaySettings.numbers.formatStringY;
            const explicitSystem = this.props.overlaySettings.global.explicitSystem;
            if (formatStringX !== undefined && formatStyingY !== undefined && explicitSystem !== undefined) {
                AST.set(frame.wcsInfo, `Format(${frame.dirX})=${formatStringX}, Format(${frame.dirY})=${formatStyingY}, System=${explicitSystem},` + dirAxesSetting);
            }
        }

        const className = classNames("overlay-canvas", {docked: this.props.docked});
        return <canvas className={className} style={{width: w, height: h}} id="overlay-canvas" ref={this.getRef} />;
    }
}
