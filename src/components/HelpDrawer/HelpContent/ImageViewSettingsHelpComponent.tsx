import * as React from "react";
import {ImageComponent} from "./ImageComponent";
import imageOverlayDemo from "static/help/image_overlay_demo.png";
import imageOverlayDemo_d from "static/help/image_overlay_demo_d.png";

export class ImageViewSettingsHelpComponent extends React.Component {
    public render() {
        return (
            <div>
                <p>The image view settings dialogue allows users to customize coordinate grid related properties in the image viewer.</p>

                <h3 id="global">Global</h3>
                <p>This section allows users to</p>
                <ul>
                    <li>set a global color theme for the grid overlay</li>
                    <li>configure grid line rendering accuracy</li>
                    <li>put coordinate labels inside or outside the image</li>
                    <li>select a coordinate reference frame to generate the grid overlay</li>
                </ul>

                <h3 id="title">Title</h3>
                <p>A custom title can be added in the image view. Its font type, font size, and color are configurable.</p>

                <h3 id="ticks">Ticks</h3>
                <p>This section allows users to changes the ticks properties, including location, density, color, line width, and length of major and minor ticks</p>

                <h3 id="grid">Grid</h3>
                <p>The appearance of the coordinate grid lines is customizable, including visibility, color, and line width.</p>

                <h3 id="border">Border</h3>
                <p>This section allows users to change the style of the axis border, including visibility, color, and width.</p>

                <h3 id="axes">Axes</h3>
                <p>This section allows users to adjust the appearance of an interior axis overlay, including visibility, color, and line width.</p>

                <h3 id="numbers">Numbers</h3>
                <p>This sections allows users to customize the appearance of tick values, including:</p>
                <ul>
                    <li>visibility</li>
                    <li>font type</li>
                    <li>font size</li>
                    <li>color</li>
                    <li>format as sexagesimal or decimal degree</li>
                    <li>coordinate precision</li>
                </ul>

                <h3 id="labels">Labels</h3>
                <p>This section allows users to modify the styles of the x and y labels, such as font type, font size, and color. A custom label can be defined.</p>

                <h3 id="beam">Beam</h3>
                <p>This section allows users to change the appearance of a beam overlay (color, type, and line width) and adjust its position in the image viewer.</p>

                <h4>EXAMPLE</h4>
                <p><ImageComponent light={imageOverlayDemo} dark={imageOverlayDemo_d} width="90%"/></p>

            </div>
        );
    }
}
