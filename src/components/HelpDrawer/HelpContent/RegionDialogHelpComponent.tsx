import * as React from "react";

export class RegionDialogHelpComponent extends React.Component {
    public render() {
        return (
            <div>
                <p>The region configuration dialog allows you to change the appearance of a region, such as</p>
                <ul>
                    <li>color</li>
                    <li>linewidth</li>
                    <li>line style (solid or dashed)</li>
                </ul>
                <p>and region properties, such as</p>
                <ul>
                    <li>region name</li>
                    <li>region location and shape properties in image or world coordinate</li>
                </ul>
                <p>
                    Region properties can be defined in world coordinate. If the coordinate reference system is FK4, FK5, or ICRS, the coordinate format is
                    sexagesimal. If the coordinate system is Galactic or Ecliptic, the coordinate format is decimal degree. Region size can be defined in
                    arcsecond with <code>&quot;</code>, in arcminute with <code>&apos;</code>, or in degree with <code>deg</code>.
                </p>
                <br />
                <h4 id="note">NOTE</h4>
                <ul>
                    <li>The displayed image coordinates refer to the spatial reference image as indicated in the title of the dialog.</li>
                    <li>The appearance of a region on a spatially matched image may be distorted due to projection effects.</li>
                </ul>
                <h4 id="tip">TIP</h4>
                <p>
                    <code>Double-Click</code> on a region in the image viewer or on an entry in the region list widget will bring up this region configuration
                    dialog.
                </p>
            </div>
        );
    }
}
