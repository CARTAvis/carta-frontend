import * as AST from "ast_wrapper";
import {Context as SvgContext} from "svgcanvas";

import {ImageType} from "enums";
import {type ImageViewItem} from "models";
import {type OverlaySettings, type OverlayStore} from "stores";

const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * Renders the AST overlay (coordinate grid, labels, ticks, title, border) to SVG
 * by replacing the AST canvas context with an svgcanvas Context that records
 * all Canvas 2D calls as SVG elements.
 */
export function renderAstOverlayToSvg(overlayStore: OverlayStore, image: ImageViewItem, overlaySettings: OverlaySettings, pixelRatio: number): SVGGElement | null {
    try {
        const frame = image.type === ImageType.COLOR_BLENDING ? image.store.baseFrame : image.store;
        if (!frame) {
            return null;
        }

        const wcsInfoSelected = frame.isOffsetCoord ? frame.wcsInfoOffset : frame.wcsInfo;
        const wcsInfo = frame.spatialReference ? frame.transformedWcsInfo : wcsInfoSelected;
        const padding = overlayStore.padding;
        const frameView = frame.spatialReference ? frame.spatialReference.requiredFrameView : frame.requiredFrameView;

        if (!wcsInfo || !frameView) {
            return null;
        }

        const viewWidth = overlayStore.viewWidth * pixelRatio;
        const viewHeight = overlayStore.viewHeight * pixelRatio;

        // Create svgcanvas context to intercept all Canvas 2D calls
        const svgCtx = new SvgContext({width: viewWidth, height: viewHeight});

        // Create a temporary hidden canvas for AST.setCanvas (it extracts the 2D context)
        // Then monkey-patch Module.gridContext with our SVG context
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = viewWidth;
        tempCanvas.height = viewHeight;
        AST.setCanvas(tempCanvas);

        // AST.setCanvas internally applies scale and translate to the real canvas context.
        // We must manually apply these same transforms to our SVG context so it isn't upside down.
        svgCtx.scale(1, -1);
        svgCtx.translate(0, -viewHeight);

        const realCtx = tempCanvas.getContext("2d");
        if (realCtx) {
            svgCtx.font = realCtx.font;
        }

        // Store the original context reference and replace with our SVG context
        const originalGridContext = (AST as any).gridContext;

        // Create a proxy to forward missing properties/methods to the real context
        // because svgcanvas might lack some advanced Canvas2D methods used by AST
        const proxyCtx = new Proxy(svgCtx, {
            get(target, prop) {
                if (prop === "canvas") return tempCanvas;
                // svgcanvas implements clearRect by drawing a solid white rectangle if the context
                // is transformed. This obscures the raster image and other layers behind it.
                // Since our svgCtx starts empty anyway, clearRect can be safely ignored.
                if (prop === "clearRect") return () => {};

                if (prop in target) {
                    const val = (target as any)[prop];
                    return typeof val === "function" ? val.bind(target) : val;
                }
                if (realCtx && prop in realCtx) {
                    const val = (realCtx as any)[prop];
                    return typeof val === "function" ? val.bind(realCtx) : val;
                }
                return undefined;
            },
            set(target, prop, value) {
                if (prop in target) {
                    (target as any)[prop] = value;
                } else if (realCtx) {
                    (realCtx as any)[prop] = value;
                }
                return true;
            }
        });

        (AST as any).gridContext = proxyCtx;

        let tempWcsInfo: AST.FrameSet | null = null;
        try {
            tempWcsInfo = AST.copy(wcsInfo);
            if (!tempWcsInfo) {
                return null;
            }

            if (!frame.hasSquarePixels) {
                const scaleMapping = AST.scaleMap2D(1.0, 1.0 / frame.aspectRatio);
                const newFrame = AST.frame(2, "Domain=PIXEL");
                AST.addFrame(tempWcsInfo, 1, scaleMapping, newFrame);
                AST.setI(tempWcsInfo, "Base", frame.isOffsetCoord ? 4 : 3);
                AST.setI(tempWcsInfo, "Current", overlaySettings.isImgCoordinates ? 3 : 2);
            }

            if (frame.isOffsetCoord && overlaySettings.isWcsCoordinates) {
                const fovSizeInArcsec = frame.getWcsSizeInArcsec(frame.fovSize);
                const viewSize = fovSizeInArcsec.x > fovSizeInArcsec.y ? fovSizeInArcsec.y : fovSizeInArcsec.x;
                const factor = 2;
                let unit: string;
                let format: string;

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

                if (overlaySettings.labels.customText) {
                    AST.set(tempWcsInfo, `Format(1)=${format}, Format(2)=${format}, Unit(1)="", Unit(2)=""`);
                } else {
                    AST.set(tempWcsInfo, `Format(1)=${format}, Format(2)=${format}, Unit(1)=${unit}, Unit(2)=${unit}`);
                }
            }

            if (overlaySettings.labels.customText) {
                AST.set(tempWcsInfo, `Unit(1)="", Unit(2)=""`);
            }

            let currentStyleString = overlayStore.styleString(frame);

            if (!frame.validWcs) {
                currentStyleString = currentStyleString.replace(/System=.*?,/, "").replaceAll(/Format\(\d\)=.*?,/g, "");
            }

            if (!overlaySettings.title.customText) {
                currentStyleString += `, Title="${image?.store?.filename.replace(/%/g, "%%%%").replace(/"/g, "\u201C")}"`;
            } else if (image?.store?.titleCustomText?.length) {
                currentStyleString += `, Title="${image?.store?.titleCustomText.replace(/%/g, "%%%%").replace(/"/g, "\u201C")}"`;
            } else {
                currentStyleString += `, Title=${""}`;
            }

            if (frame.isOffsetCoord) {
                currentStyleString += `, LabelUnits=1`;
            }

            AST.plot(
                tempWcsInfo,
                frameView.xMin,
                frameView.xMax,
                frameView.yMin / frame.aspectRatio,
                frameView.yMax / frame.aspectRatio,
                viewWidth,
                viewHeight,
                padding.left * pixelRatio,
                padding.right * pixelRatio,
                padding.top * pixelRatio,
                padding.bottom * pixelRatio,
                currentStyleString
            );

            if (/No grid curves can be drawn for axis/.test(AST.getLastErrorMessage())) {
                AST.plot(
                    tempWcsInfo,
                    frameView.xMin,
                    frameView.xMax,
                    frameView.yMin / frame.aspectRatio,
                    frameView.yMax / frame.aspectRatio,
                    viewWidth,
                    viewHeight,
                    padding.left * pixelRatio,
                    padding.right * pixelRatio,
                    padding.top * pixelRatio,
                    padding.bottom * pixelRatio,
                    currentStyleString.replace(/Gap\(\d\)=[^,]+, ?/g, "").replace("Grid=1", "Grid=0")
                );
            }
        } catch (e) {
            console.error("Error during AST SVG plot:", e);
        } finally {
            // Clean up AST objects even if an exception occurred
            if (tempWcsInfo) {
                AST.deleteObject(tempWcsInfo);
            }
            AST.clearLastErrorMessage();

            // Restore original context
            if (originalGridContext !== undefined) {
                (AST as any).gridContext = originalGridContext;
            }
        }

        // Extract SVG content from svgcanvas and wrap in a group
        const svgRoot = svgCtx.getSvg() as SVGSVGElement;
        const group = document.createElementNS(SVG_NS, "g");
        group.setAttribute("id", "ast-overlay");

        // Move all children from the svgcanvas SVG root to our group
        while (svgRoot.childNodes.length > 0) {
            group.appendChild(svgRoot.childNodes[0]);
        }

        return group;
    } catch (e) {
        console.error("Critical error in renderAstOverlayToSvg:", e);
        return null;
    }
}
