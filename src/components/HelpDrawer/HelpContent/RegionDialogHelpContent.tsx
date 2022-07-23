export const REGION_DIALOG_HELP_CONTENT = (
    <div>
        <p>The region configuration dialog allows you to change the appearance of a region, such as</p>
        <ul>
            <li>Color</li>
            <li>Linewidth</li>
            <li>Line style (solid or dashed)</li>
        </ul>
        <p>and region properties, such as</p>
        <ul>
            <li>Region name</li>
            <li>Region location and shape properties in image or world coordinate</li>
        </ul>
        <p>
            Region properties can be defined in world coordinate. If the coordinate reference system is FK4, FK5, or ICRS, the coordinate format is sexagesimal. If the coordinate system is Galactic or Ecliptic, the coordinate format is
            decimal degree. Region size can be defined in arcsecond with <code>&quot;</code>, in arcminute with <code>&apos;</code>, or in degree with <code>deg</code>.
        </p>
        <p>
            The selected region can be centered in the image viewer by clicking the <code>Focus</code> button at the bottom of the dialog. The region can be locked to prevent accidental edition by clicking the <code>Lock</code> button. To delete the selected region, click the <code>Delete</code> button or press <code>Delete</code> or <code>Backspace</code> key.
        </p>

        <br />
        <h4 id="note">NOTE</h4>
        <ul>
            <li>The displayed image coordinates refer to the spatial reference image as indicated in the title of the dialog.</li>
            <li>The appearance of a region on a spatially matched image may be distorted due to projection effects.</li>
            <li>On a wide field image with noticible projection distortion, the displayed region angular size is an approximation.</li>
        </ul>
        <h4 id="tip">TIP</h4>
        <p>
            <code>Double-Click</code> on a region in the image viewer or on an entry in the region list widget will bring up this region configuration dialog.
        </p>
    </div>
);
