import * as React from "react";

export class FileBrowserHelpComponent extends React.Component {
    public render() {
        return (
            <div>
                <p>File browser allows users to</p>
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
                <p>Images can be loaded as raster via <strong>File</strong> -&gt; <strong>Load image</strong>, or appended as raster via <strong>File</strong> -&gt; <strong>Append image</strong>. All loaded images will be closed if users
                    load an image with <strong>Load image</strong>. Image shown in the image viewer can be closed via <strong>File</strong> -&gt; <strong>Close image</strong>. Images or subimages can be saved in CASA or FITS format
                    via <strong>File</strong> -&gt; <strong>Save image</strong>. Note that when saving an image, the server side needs to support write permission.</p>
                <p>When an image file is selected, its basic image properties are summarized in the &quot;File Information&quot; tab on the right-hand side. Full image header is shown in the &quot;Header&quot; tab.</p>
                <p>Multiple images can be loaded at once by selecting multiple images with <code>ctrl/cmd+click</code> or <code>shift+click</code> from the file list, and then clicking the &quot;Load selected&quot; button.</p>
                <p>If users would like to use the Stokes analysis widget but the Stokes images are individual files (i.e., image_I.fits, image_Q.fits, image_U.fits, and image_V.fits), a Stokes hypercube can be formed by selecting required Stokes images then clicking the &quot;Load as hypercube&quot; button. CARTA will combined the images and effectively there is only one image loaded.</p>
                <h3 id="regions">Regions</h3>
                <p>Region files can be imported via <strong>File</strong> -&gt; <strong>Import regions</strong>. When a region file is selected, its content is shown in the &quot;Region Information&quot; tab. Regions can be exported as
                    region text files via <strong>File</strong> -&gt; <strong>Export regions</strong>. CASA and ds9 region text file definitions in world or image coordinates are supported. Note that when exporting a region text file, the
                    server side needs to support write permission.</p>
                <p>Multiple region files can be loaded at once by selecting multiple region files with <code>ctrl/cmd+click</code> or <code>shift+click</code> from the file list, and then clicking the &quot;Load Region&quot; button.</p>   
                <h3 id="catalogs">Catalogs</h3>
                <p>Catalogs can be loaded and visualized as tables via <strong>File</strong> -&gt; <strong>Import catalog</strong>. When a catalog file is selected, its basic catalog properties are summarized in the &quot;Catalog
                    Information&quot; tab on the right-hand side. Full catalog column header is shown in the &quot;Catalog Header&quot; tab.</p>
                <p>Multiple catalog files can be loaded at once by selecting multiple catalog files with <code>ctrl/cmd+click</code> or <code>shift+click</code> from the file list, and then clicking the &quot;Load Catalog&quot; button.</p>
            </div>
        );
    }
}
