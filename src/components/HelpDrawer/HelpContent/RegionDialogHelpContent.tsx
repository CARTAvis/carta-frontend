export const REGION_DIALOG_HELP_CONTENT = (
    <div>
        <p>
            The Region Configuration Dialog provides a <b>Configuration</b> tab where you can customize region properties such as
            <ul>
                <li>Region name</li>
                <li>Region location and shape properties in image or world coordinate</li>
            </ul>
            and a <b>Styling</b> tab, where you can configure region appearance settings such as
            <ul>
                <li>Color</li>
                <li>Line width</li>
                <li>Line style (solid or dashed)</li>
            </ul>
        </p>
        <p>
            Region properties can be defined in world coordinates. If the coordinate reference system is <code>FK4</code>, <code>FK5</code>, or <code>ICRS</code>, the coordinate format is sexagesimal. If the coordinate system is{" "}
            <code>Galactic</code> or <code>Ecliptic</code>, the coordinate format is decimal degrees. Region size can be defined in arcseconds with <code>&quot;</code>, in arcminutes with <code>&apos;</code>, or in degrees with{" "}
            <code>deg</code>.
        </p>
        <p>
            In an elliptical region, <b>Semi-axes</b> input fields are required to define the size. The first and the second fields refer to the semi-major and the semi-minor axes, respectively. The semi-major axis is aligned to the
            North-South direction of the sky, while the semi-minor axis is aligned to the East-West direction of the sky. The origin (0 degree) of the <b>P.A.</b> (position angle) points to the North and the P.A. increases toward the East.
        </p>
        <p>
            You can center the selected region in the Image Viewer by clicking the <b>Focus</b> button at the bottom of the dialog. In addition, you can lock the region to prevent accidental modification by clicking the <b>Lock</b> button.
            The same operations can be performed in the Region List Widget. To delete the selected region, click the <b>Delete</b> button or press <code>Delete</code> or <code>Backspace</code> key.
        </p>

        <br />
        <h4 id="note">NOTE</h4>
        <ul>
            <li>The displayed image coordinates refer to the spatial reference image as indicated in the title of the dialog.</li>
            <li>The appearance of a region on a spatially matched image may be distorted due to projection effects.</li>
            <li>On a wide field image with noticeable projection distortion, the displayed region angular size is an approximation.</li>
            <li>
                Image annotations share most of the characteristics of regions of interest, but they cannot be used as a reference to derive image analytics. You can configure the location and shape properties in the <b>Configuration</b>{" "}
                tab and appearance in the <b>Styling</b> tab.
            </li>
        </ul>

        <h4 id="tip">TIP</h4>
        <p>
            <code>Double-Click</code> on a region in the Image Viewer or on an entry in the Region List Widget will bring up this Region Configuration Dialog.
        </p>
    </div>
);
