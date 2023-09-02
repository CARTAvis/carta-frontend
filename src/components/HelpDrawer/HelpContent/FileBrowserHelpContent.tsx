export const FILE_BROWSER_HELP_CONTENT = (
    <div>
        <p>File Browser provides options to</p>
        <ul>
            <li>Load images in CASA, FITS, MIRIAD, or HDF5-IDIA schema format as raster</li>
            <li>Load individual Stokes images to form a single Stokes hypercube</li>
            <li>
                Load images with the Lattice Expression Language (
                <a href="https://casacore.github.io/casacore-notes/223.html" target="_blank" rel="noreferrer">
                    LEL
                </a>
                )
            </li>
            <li>
                Load images with swapped-axes cubes (<em>image visualization only</em>)
            </li>
            <li>Save images or subimages in CASA or FITS format</li>
            <li>Import and export region text files in CASA (.crtf) or ds9 (.reg) format</li>
            <li>Import catalog files in VOTable or FITS format</li>
            <li>Search for files using the filtering functions</li>
            <li>Navigate through the file system with an absolute path</li>
            <li>View image header information, and region and catalog file information</li>
        </ul>
        <h3 id="fileSystemNavigation">File system navigation</h3>
        <p>
            The <b>Breadcrumbs</b> at the top of the dialog show the current working directory. Each level of directories is clickable as a shortcut for navigation. By clicking the <b>Pen</b> button, you may supply an absolute path (with
            respect to the path set by the <code>carta_backend</code> startup keyword argument <code>--top_level_folder</code>). For the user deployment mode of CARTA, the default top level folder is the root (<code>/</code>). If you are
            aware of a context change in the current working directory, you can use the <b>Refresh</b> button (the circular arrow icon) to reload the file list.
        </p>
        <h3 id="fileFiltering">File filtering</h3>
        <p>A file filter can be applied to the current directory. Three methods are provided:</p>
        <ul>
            <li>Fuzzy search: free typing</li>
            <li>
                Unix-style search: e.g., <code>*.fits</code>
            </li>
            <li>
                Regular expression (regex) search: e.g., <code>colou?r</code>
            </li>
        </ul>
        <p>
            By default ("Filter by file content" as specified with the <b>File list</b> dropdown menu in the <b>Global</b> tab of the Preferences Dialog), only files that meet the supported image formats are listed in the image file
            browser. If you often work with directories which contain many different types of files, you may wish to switch to the alternative image file list generation modes, "Filter by extension" or "All files", to speed up the list
            generation process.
        </p>
        <h3 id="images">Images</h3>
        <p>
            Images can be loaded and rendered as raster images via <b>File -&gt; Open Image</b>, or appended via <b>File -&gt; Append Image</b>. All loaded images will be closed if you load an image or a set of images with <b>Open Image</b>
            . The active image shown in the Image Viewer can be closed via <b>File -&gt; Close Image</b>. Images or subimages can be saved in CASA or FITS format via <b>File -&gt; Save Image</b>. Note that images can only be saved if
            appropriate write permissions are configured on your file system. Optionally, you may apply a new rest frequency to the saved image cube so that its velocity axis can be re-computed with respect to the new rest frequency.
        </p>
        <p>
            When an image file is selected, its basic image properties are summarized in the <b>File Information</b> tab on the right-hand side. The full image header is shown in the <b>Header</b> tab. You can search the header or export
            the header as a text file with the tools in the bottom-right corner of the <b>Header</b> tab.
        </p>
        <p>
            You can load or append multiple images at once by selecting multiple images with <code>ctrl/cmd+click</code> or <code>shift+click</code> from the file list, and then clicking the <b>Load selected</b> button or the{" "}
            <b>Append selected</b> button, respectively.
        </p>
        <p>
            If you would like to use the Stokes Analysis Widget but your Stokes cube is split into individual files (one per Stokes), you can create a Stokes hypercube by selecting the desired Stokes image files and clicking the{" "}
            <b>Load as hypercube</b> button. A popup dialog will display the Stokes labels based on the image headers. If header information is not sufficient to assign a Stokes label per image, image file name will be used to guess a
            Stokes label per image. If none of the attempts is successful, you will need to assign the Stokes labels manually. Once Stokes labels are set properly, CARTA will load the files and combine them into a single virtual image with
            multiple Stokes.
        </p>
        <p>
            Images can be loaded with the Lattice Expression Language (
            <a href="https://casacore.github.io/casacore-notes/223.html" target="_blank" rel="noreferrer">
                LEL
            </a>
            ). With LEL, you can apply image arithmetics and load the resulting image for visualization and analysis. To enable this image loading mode, click the <b>Filter</b> dropdown menu and switch to <b>Image arithmetic</b> mode. You
            may click on image files in the file list to set up the expression quickly.
        </p>
        <p>
            If you have non-standard cubes with axes swapped intentionally (e.g., RA-FREQ-DEC-STOKES), you can load them in CARTA as well. The axes labels are derived from the image header "CTYPEn".{" "}
            <em>Please note that CARTA supports image visualization only in this use case. Region analytics are not supported.</em>
        </p>
        <h3 id="regions">Regions</h3>
        <p>
            Region files can be imported via <b>File -&gt; Import Regions</b>. When a region file is selected, its content is shown in the <b>Region Information</b> tab. All or a subset of regions can be exported as a region text file via{" "}
            <b>File -&gt; Export Regions</b>. CASA and ds9 region text file definitions in world or image coordinates are supported. Note that regions can only be exported if appropriate write permissions are configured on your file system.
        </p>
        <p>
            You can load multiple region files at once by selecting multiple region files with <code>ctrl/cmd+click</code> or <code>shift+click</code> from the file list, and then clicking the <b>Load region</b> button.
        </p>
        <h3 id="catalogs">Catalogs</h3>
        <p>
            Catalogs can be loaded and visualized as tables via <b>File -&gt; Import Catalog</b>. When a catalog file is selected, its basic catalog properties are summarized in the <b>Catalog Information</b> tab on the right-hand side.
            Full catalog column header is shown in the <b>Catalog Header</b> tab.
        </p>
        <p>
            You can load multiple catalog files at once by selecting multiple catalog files with <code>ctrl/cmd+click</code> or <code>shift+click</code> from the file list, and then clicking the <b>Load catalog</b> button.
        </p>
        <br />
        <h4>TIPS</h4>
        CARTA can remember the directory where you loaded an image and set it as the initial directory when you launch CARTA next time. This is configurable in the <b>Global</b> tab of the Preferences Dialog (<b>File -&gt; Preferences</b>).
    </div>
);
