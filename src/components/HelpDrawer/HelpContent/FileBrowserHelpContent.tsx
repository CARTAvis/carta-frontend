export const FILE_BROWSER_HELP_CONTENT = (
    <div>
        <p>File browser allows you to</p>
        <ul>
            <li>Load images in CASA, FITS, MIRIAD, or HDF5-IDIA schema format as raster</li>
            <li>Load individual Stokes images as a single Stokes hypercube</li>
            <li>
                Load images with the Lattice Expression Language (
                <a href="https://casadocs.readthedocs.io/en/stable/notebooks/image_analysis.html?highlight=LEL#Lattice-Expression-Language" target="_blank" rel="noreferrer">
                    LEL
                </a>
                )
            </li>
            <li>Save images or subimages in CASA or FITS format</li>
            <li>Import and export region text files in CASA (.crtf) or ds9 (.reg) format</li>
            <li>Import catalog files in VOTable or FITS format</li>
            <li>View image header information, and region and catalog file information</li>
        </ul>
        <h3 id="fileFiltering">File filtering</h3>
        <p>A file filter can be applied to the current directory. Three methods are provided:</p>
        <ul>
            <li>Fuzzy search: free typing</li>
            <li>Unix-style search: e.g., *.fits</li>
            <li>Regular expression search: e.g., colou?r</li>
        </ul>
        <p>
            By default (<code>Filter by file content</code>), only files that met the supported image formats are listed in the image file browser. If you often work with directories which contain many different types of files, you may wish
            to switch to the alternative image file list generation modes, <code>Filter by extension</code> or <code>All files</code>, to speed up the process. This is configurable in the <code>Global</code> tab of the preferences dialog (
            <strong>File</strong> -&gt; <strong>Preferences</strong>).
        </p>

        <h3 id="images">Images</h3>
        <p>
            Images can be loaded as raster via <strong>File</strong> -&gt; <strong>Open image</strong>, or appended as raster via <strong>File</strong> -&gt; <strong>Append image</strong>. All loaded images will be closed if you load an
            image or a set of images with <strong>Open image</strong>. The active image shown in the image viewer can be closed via <strong>File</strong> -&gt; <strong>Close image</strong>. Images or subimages can be saved in CASA or FITS
            format via <strong>File</strong> -&gt; <strong>Save image</strong>. Note that images can only be saved if appropriate write permissions are configured on the server. Optionally, you may apply a new rest frequency to the saved
            image cube so that its velocity axis can be re-computed with respect to the new rest frequency.
        </p>
        <p>
            When an image file is selected, its basic image properties are summarized in the <code>File Information</code> tab on the right-hand side. The full image header is shown in the <code>Header</code> tab. You can search the header
            or export the header as a text file with the tools at the bottom-right corner of the <code>Header</code> tab.
        </p>
        <p>
            You can load or append multiple images at once by selecting multiple images with <code>ctrl/cmd+click</code> or <code>shift+click</code> from the file list, and then clicking the <code>Load selected</code> or the{" "}
            <code>Append selected</code> button, respectively.
        </p>
        <p>
            If you would like to use the Stokes analysis widget, but your image is split into individual files (one per Stokes), you can create a Stokes hypercube by selecting the desired Stokes image files and clicking the "Load as
            hypercube" button. A popup dialog will display the Stokes labels based on the image headers. If header information is not sufficient to assign a Stokes label per image, image file name will be used to guess a Stokes label per
            image. If none of the attempts is successful, you will need to assign the Stokes labels manually. Once Stokes labels are set properly, CARTA will load the files and combine them into a single image with multiple Stokes.
        </p>
        <p>
            Images can be loaded with the Lattice Expression Language (
            <a href="https://casadocs.readthedocs.io/en/stable/notebooks/image_analysis.html?highlight=LEL#Lattice-Expression-Language" target="_blank" rel="noreferrer">
                LEL
            </a>
            ). With LEL, you can apply image arithmetic and load the resulting image for visualization and analysis. To enable this image loading mode, click the <code>Filter</code> dropdown menu and switch to <code>Image arithmetic</code>.
            You may click on image files to set up the expression quickly.
        </p>
        <h3 id="regions">Regions</h3>
        <p>
            Region files can be imported via <strong>File</strong> -&gt; <strong>Import regions</strong>. When a region file is selected, its content is shown in the <code>Region Information</code> tab. Some or all regions can be exported
            as a region text file via <strong>File</strong> -&gt; <strong>Export regions</strong>. CASA and ds9 region text file definitions in world or image coordinates are supported. Note that regions can only be exported if appropriate
            write permissions are configured on the server.
        </p>
        <p>
            You can load multiple region files at once by selecting multiple region files with <code>ctrl/cmd+click</code> or <code>shift+click</code> from the file list, and then clicking the <code>Load Region</code> button.
        </p>
        <h3 id="catalogs">Catalogs</h3>
        <p>
            Catalogs can be loaded and visualized as tables via <strong>File</strong> -&gt; <strong>Import catalog</strong>. When a catalog file is selected, its basic catalog properties are summarized in the{" "}
            <code>Catalog Information</code> tab on the right-hand side. Full catalog column header is shown in the <code>Catalog Header</code> tab.
        </p>
        <p>
            You can load multiple catalog files at once by selecting multiple catalog files with <code>ctrl/cmd+click</code> or <code>shift+click</code> from the file list, and then clicking the <code>Load Catalog</code> button.
        </p>
        <br />
        <h4>TIPS</h4>
        <p>
            CARTA can remember the directory where you loaded an image and set it as the initial directory when you launch CARTA next time. This is configurable in the <code>Global</code> tab of the preferences dialog (<strong>File</strong>{" "}
            -&gt; <strong>Preferences</strong>).
        </p>
    </div>
);
