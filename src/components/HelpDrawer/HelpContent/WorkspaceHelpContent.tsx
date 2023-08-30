export const WORKSPACE_HELP_CONTENT = (
    <div>
        <p>
            <em>Full workspace features are under development. In this release, workspace support is limited.</em>
        </p>
        <h3>Workspace saving and restoring</h3>
        <p>
            A "workspace" in CARTA refers to a snapshot of the GUI state that you can save and restore for future usage. Ultimately, a CARTA workspace will also be sharable so that you can use it as a collaborative tool to work with your
            collaborators over the internet. As an initial attempt of supporting a CARTA workspace, with the current release, the following components are saveable and restorable:
            <ul>
                <li>All loaded images except generated in-memory images (e.g., moment images, PV images, etc.)</li>
                <li>Image matching states, including spatial, spectral, and raster</li>
                <li>Raster rendering</li>
                <li>Contour rendering layers</li>
                <li>Vector overlay layers</li>
                <li>Regions and image annotations</li>
            </ul>
            Image view grid layout, GUI layout, and preferences are not supported yet.
        </p>
        <p>
            To save a workspace, use the menu <b>File -&gt; Save Workspace</b>. To restore a workspace, use the menu <b>File -&gt; Open Workspace</b>.
        </p>
        <p>
            When a workspace is selected in the file list, basic workspace information is displayed in the panel on the right-hand side, including:
            <ul>
                <li>A screenshot of the GUI (currently limited to the Image Viewer only)</li>
                <li>The name of the workspace</li>
                <li>Number of regions</li>
                <li>File name of the spatial reference image</li>
                <li>File name of the spectral reference image</li>
                <li>File name of the raster scaling reference image</li>
                <li>A list of all image files and their validation results</li>
            </ul>
        </p>
        <p>
            If you find the image validation result is <code>invalid</code>, please check if the image is still accessible on the file system. Should you encounter situations that raise concerns, we encourage you to reach out for
            assistance. You can connect with our <a href="mailto:support@carta.freshdesk.com">helpdesk</a> or utilize the{" "}
            <a href="https://github.com/CARTAvis/carta/issues" target="_blank" rel="noreferrer">
                Github
            </a>{" "}
            repository to file an issue.
        </p>
        <h3>
            Workspace sharing (<em>experimental</em>; controller-only feature)
        </h3>
        <p>
            If you are using a site-deployment-mode version of CARTA with the CARTA{" "}
            <a href="https://carta-controller.readthedocs.io/en/dev/" target="_blank" rel="noreferrer">
                controller
            </a>
            , you may share a workspace with your collaborators via a URL. Once you have saved a workspace via <b>File -&gt; Save Workspace</b>, a <b>Share</b> button in gray color will show up at the top-right corner of the CARTA GUI. Once
            you click the <b>Share</b> button, through the popup window you can generate a unique URL linked to the current workspace that you have just saved. Via the URL, your collaborators will be able to restore the workspace to proceed
            data investigation. Please note that your collaborators need to have file read permission for all the images in the workspace in order to get the workspace fully restored. If there are images that your collaborators do not have
            read permission on the server, those images will be discarded in the workspace restoration process with a warning.
        </p>
    </div>
);
