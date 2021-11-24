export const FILE_BROWSER_HELP_CONTENT = (
    <div>
        <p>File browser allows you to</p>
        <ul>
            <li>Load images in CASA, FITS, MIRIAD, or HDF5-IDIA schema formats as raster</li>
            <li>Save images or subimages in CASA or FITS formats</li>
            <li>Import and export region text files in CASA (.crtf) or ds9 (.reg) formats</li>
            <li>Import catalogue files in VOTable or FITS formats</li>
        </ul>
        <h3 id="fileFiltering">File filtering</h3>
        <p>A file filter can be applied to the current directory. Three methods are provided:</p>
        <ul>
            <li>Fuzzy search: free typing</li>
            <li>Unix-style search: e.g., *.fits</li>
            <li>Regular expression search: e.g., colou?r</li>
        </ul>
        <h3 id="images">Images</h3>
        <p>
            Images can be loaded as raster via <strong>File</strong> -&gt; <strong>Load image</strong>, or appended as raster via <strong>File</strong> -&gt; <strong>Append image</strong>. All loaded images will be closed if you load an
            image with <strong>Load image</strong>. The image shown in the image viewer can be closed via <strong>File</strong> -&gt; <strong>Close image</strong>. Images or subimages can be saved in CASA or FITS format via{" "}
            <strong>File</strong> -&gt; <strong>Save image</strong>. Note that images can only be saved if the appropriate write permissions are enabled on the server.
        </p>
        <p>
            When an image file is selected, its basic image properties are summarized in the <code>File Information</code> tab on the right-hand side. Full image header is shown in the <code>Header</code> tab.
        </p>
        <p>
            You can load multiple images at once by selecting multiple images with <code>ctrl/cmd+click</code> or <code>shift+click</code> from the file list, and then clicking the <code>Load selected</code> button.
        </p>
        <p>
            If you would like to use the Stokes analysis widget, but your image is split into individual files (one per Stokes), you can create a Stokes hypercube by selecting the desired Stokes image files and clicking the "Load as
            hypercube" button. CARTA will load the files combined into a single image.
        </p>
        <h3 id="regions">Regions</h3>
        <p>
            Region files can be imported via <strong>File</strong> -&gt; <strong>Import regions</strong>. When a region file is selected, its content is shown in the <code>Region Information</code> tab. Regions can be exported as region
            text files via <strong>File</strong> -&gt; <strong>Export regions</strong>. CASA and ds9 region text file definitions in world or image coordinates are supported. Note that regions can only be exported if the appropriate write
            permissions are enabled on the server.
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
    </div>
);
