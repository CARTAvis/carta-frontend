import * as React from "react";
import {ImageComponent} from "./ImageComponent";
import headPreferenceButton from "static/help/head_preference_button.png";
import headPreferenceButton_d from "static/help/head_preference_button_d.png";

export class PreferencesHelpComponent extends React.Component {
    public render() {
        return (
            <div>
                <p><ImageComponent light={headPreferenceButton} dark={headPreferenceButton_d} width="90%"/></p>
                <p>The preferences dialog provides a centralized place to customize the entire graphical user interface and performance control parameters. All settings are recorded and applied to new CARTA sessions. Some settings are
                    effective immediately.</p>
                <h3 id="global">Global</h3>
                <p>This section provides usability customization.</p>
                <ul>
                    <li>Theme: the color theme of the graphical user interface (effective immediately)</li>
                    <li>Auto-launch file browser: launch file browser when CARTA is initialized</li>
                    <li>Initial layout: the default layout for a new CARTA session</li>
                    <li>Initial cursor position: fix cursor at the image center or have cursor free to move</li>
                    <li>Initial zoom level: view full image or view image with one image pixel to one screen pixel ratio</li>
                    <li>Zoom to: control the focus of zooming with scrolling wheel</li>
                    <li>Enable drag-to-pan: when enabled, pan action is achieved by click-and-dragging. When disabled, pan action is achieved by a click where the clicked pixel will be centered in the image viewer.</li>
                    <li>WCS matching on append: trigger WCS matching automatically for newly appended images</li>
                    <li>Spectral matching: spectral convention to be used for spectral matching of image cubes</li>
                    <li>Transparent image background: when this is enabled, the exported png image will have a transparent background. When it is disabled (default), a white or a black background is added depending on the GUI theme.</li>
                </ul>
                <h3 id="render-configuration">Render configuration</h3>
                <p>This section provides customization of how a raster image is rendered by default.</p>
                <ul>
                    <li>Default scaling: scaling function to be applied to a colormap</li>
                    <li>Default colormap: colormap for rendering a raster image</li>
                    <li>Default percentile ranks: clip level to be applied to the pixel value-to-color mapping</li>
                    <li>NaN color: color to render a NaN (not a number) pixel</li>
                    <li>Smoothed bias/contrast: when this is enabled (default), smooth bias and contrast functions are applied, resulting   a smooth scaling function. When it is disabled, the final scaling function contains kinks.</li>
                </ul>
                <h3 id="contour-configuration">Contour configuration</h3>
                <p>This section provides customization of how a contour layer is calculated and rendered by default.</p>
                <ul>
                    <li>Generator type: default level generator type</li>
                    <li>Smoothing mode: smoothing method to be applied before calculating contour vertices</li>
                    <li>Default smoothing factor: kernel size of the selected smoothing mode</li>
                    <li>Default contour levels: number of contour levels to be generated</li>
                    <li>Thickness: contour line thickness</li>
                    <li>Default color mode: to render contours with constant color or to render color-mapped contours</li>
                    <li>Default color map: colormap for rendering color-mapped contours</li>
                    <li>Default color: color for rendering contours with constant color</li>
                </ul>
                <h3 id="overlay-configuration">Overlay configuration</h3>
                <p>This section provides customization of the image overlay in the image viewer.</p>
                <ul>
                    <li>AST color: the default color theme of the grid layers including the coordinate bound box</li>
                    <li>AST grid visible: grid line rendering</li>
                    <li>AST label visible: grid x and y labels rendering</li>
                    <li>WCS format: show world coordinates in degrees or sexagesimal or auto-formatted</li>
                    <li>Beam visible: beam rendering at the bottom-left corner of the image viewer</li>
                    <li>Beam color: the color to render a beam element</li>
                    <li>Beam type: render a beam as open shape or filled shape</li>
                    <li>Beam width: line width to render an open-shape beam</li>
                </ul>
                <h3>Catalog</h3>
                <p>This section provides options to configure the catalog widget.</p>
                <ul>
                    <li>Displayed columns: default displayed number of columns of a catalog in the widget.</li>
                </ul>
                <h3 id="region">Region</h3>
                <p>This section provides customization of region rendering properties and region creation interactivity.</p>
                <ul>
                    <li>Color: default color to render a region</li>
                    <li>Line width: default line width to render a region</li>
                    <li>Dash length: when greater than zero, region is rendered in dashed line</li>
                    <li>Region type: default region type</li>
                    <li>Creation mode: the way how rectangle and ellipse regions are created with cursor</li>
                </ul>
                <h3 id="performance">Performance</h3>
                <p>Performance related control parameters are included here. We do not recommend you to change the settings here. If the bandwidth connecting to a CARTA server is limited, you may enable the <code>low bandwidth
                    mode</code> which reduces displayed image resolution and cursor responsiveness.</p>
                <h3 id="log-events">Log events</h3>
                <p>This is for development and debugging purpose. General users should not enable anything here.</p>
            </div>
        );
    }
}
