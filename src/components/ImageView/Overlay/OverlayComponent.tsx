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
            this.canvas.width = (frame?.isPreview ? frame?.previewViewWidth : this.props.overlaySettings.viewWidth) * AppStore.Instance.pixelRatio;
            this.canvas.height = (frame?.isPreview ? frame?.previewViewHeight : this.props.overlaySettings.viewHeight) * AppStore.Instance.pixelRatio;
        }
    }

    renderCanvas = () => {
        const settings = this.props.overlaySettings;
        const frame = this.props.image?.type === ImageType.COLOR_BLENDING ? this.props.image.store?.baseFrame : this.props.image?.store;
        const appStore = AppStore.Instance;

        const wcsInfoSelected = frame.isOffsetCoord ? frame.wcsInfoShifted : frame.wcsInfo;
        const wcsInfo = frame.spatialReference ? frame.transformedWcsInfo : wcsInfoSelected;
        const frameView = frame.spatialReference ? frame.spatialReference.requiredFrameView : frame.requiredFrameView;
        if (wcsInfo && frameView && this.canvas) {
            // Take aspect ratio scaling into account
            const tempWcsInfo = AST.copy(wcsInfo);
            if (!tempWcsInfo) {
                console.log("Create wcs info copy failed.");
                return;
            }

            this.updateImageDimensions();
            AST.setCanvas(this.canvas);
            if (!frame.hasSquarePixels) {
                const scaleMapping = AST.scaleMap2D(1.0, 1.0 / frame.aspectRatio);
                const newFrame = AST.frame(2, "Domain=PIXEL");
                AST.addFrame(tempWcsInfo, 1, scaleMapping, newFrame);
                AST.setI(tempWcsInfo, "Base", 3);
                AST.setI(tempWcsInfo, "Current", 2);
            }

            if (frame.isOffsetCoord) {
                const fovSizeInArcsec = frame.getWcsSizeInArcsec(frame.fovSize);
                const viewSize = fovSizeInArcsec.x > fovSizeInArcsec.y ? fovSizeInArcsec.y : fovSizeInArcsec.x;
                const factor = 2; // jump factor
                let unit;
                let format;

                if (viewSize < 60 * factor) {
                    unit = "arcsec";
                    format = "s.*";
                } else if (viewSize < 3600 * factor) {
                    unit = "arcmin";
                    format = "m.*";
                } else {
                    unit = "deg";
                    format = "d.*";
                }

                AST.set(tempWcsInfo, `Format(1)=${format}, Format(2)=${format}, Unit(1)=${unit}, Unit(2)=${unit}`);
            }

            const plot = (styleString: string) => {
                AST.plot(
                    tempWcsInfo,
                    frameView.xMin,
                    frameView.xMax,
                    frameView.yMin / frame.aspectRatio,
                    frameView.yMax / frame.aspectRatio,
                    (frame.isPreview ? frame?.previewViewWidth : this.props.overlaySettings.viewWidth) * appStore.pixelRatio,
                    (frame.isPreview ? frame?.previewViewHeight : this.props.overlaySettings.viewHeight) * appStore.pixelRatio,
                    settings.padding.left * appStore.pixelRatio,
                    settings.padding.right * appStore.pixelRatio,
                    settings.padding.top * appStore.pixelRatio,
                    settings.padding.bottom * appStore.pixelRatio,
                    styleString
                );
            };

            let currentStyleString = settings.styleString(frame);

            // Override the AST tolerance during motion
            if (frame.moving) {
                const tolVal = Math.max((settings.global.tolerance * 2) / 100.0, 0.1);
                currentStyleString += `, Tol=${tolVal}`;
            }

            if (!frame.validWcs) {
                //Remove system and format entries
                currentStyleString = currentStyleString.replace(/System=.*?,/, "").replaceAll(/Format\(\d\)=.*?,/g, "");
            }

            if (!settings.title.customText) {
                currentStyleString += `, Title=${this.props.image?.store?.filename}`;
            } else if (this.props.image?.store?.titleCustomText?.length) {
                currentStyleString += `, Title=${this.props.image?.store?.titleCustomText}`;
            } else {
                currentStyleString += `, Title=${""}`;
            }

            if (frame.isOffsetCoord) {
                currentStyleString += `, LabelUnits=1`;
            }

            plot(currentStyleString);

            if (/No grid curves can be drawn for axis/.test(AST.getLastErrorMessage())) {
                // Try to re-plot without the grid
                plot(currentStyleString.replace(/Gap\(\d\)=[^,]+, ?/g, "").replace("Grid=1", "Grid=0"));
            }

            AST.deleteObject(tempWcsInfo);
            AST.clearLastErrorMessage();
        }
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
