import * as React from "react";

export class SpectralProfilerSettingsMomentsHelpComponent extends React.Component {
    public render() {
        return (
            <div>
                <p>Moment images can be generated and viewed with CARTA. 
                    The dialogue provides several control parameters to define 
                    how moment images are calculated, including: 
                    <ul>
                        <li>Image: the image file for moment calculations. &quot;Active&quot; 
                            refers to the image displayed in the image viewer.</li>
                        <li>Region: a region can be selected so that moment calculations 
                            are limited inside the region. &quot;Active&quot; refers to the 
                            selected region in the image viewer. If no region is selected, 
                            full image is included in the moment calculations.</li>
                        <li>Coordinate, System, and Range: the spectral range (e.g., velocity range) 
                            used for moment calculations is defined with these options. The range 
                            can be defined either via the text input fields, or via the cursor by 
                            dragging horizontally in the spectral profiler widget.</li>
                        <li>Mask and Range: these options define a pixel value range used for 
                            moment calculations. If mask is &quot;None&quot;, all pixels are 
                            included. If mask is &quot;Include&quot; or &quot;Exclude&quot;, 
                            the pixel value range defined in the text input fields is included 
                            or excluded, respectively. Alternatively, the pixel value range can 
                            be defined via the cursor by dragging vertically  in the spectral 
                            profiler widget.</li>
                        <li>Moments: which moment images to be calculated are defined here. 
                            Supported options are:
                            <ul>
                                <li>-1: Mean value of the spectrum</li>
                                <li>0: Integrated value of the spectrum</li>
                                <li>1: Intensity weighted coordinate</li>
                                <li>2: Intensity weighted dispersion of the coordinate</li>
                                <li>3: Median value of the spectrum</li>
                                <li>4: Median coordinate</li>
                                <li>5: Standard deviation about the mean of the spectrum</li>
                                <li>6: Root mean square of the spectrum</li>
                                <li>7: Absolute mean deviation of the spectrum</li>
                                <li>8: Maximum value of the spectrum</li>
                                <li>9: Coordinate of the maximum value of the spectrum</li>
                                <li>10: Minimum value of the spectrum</li>
                                <li>11: Coordinate of the minimum value of the spectrum</li>
                            </ul>                            
                        </li>            
                    </ul>
                </p>
                <p>When all the parameters are defined, by clicking the &quot;Generate&quot; 
                    button moment calculations will begin. Depending on the file size, moment 
                    calculations may take a while. If that happens, users may consider to cancel 
                    the calculations and re-define a proper region and/or spectral range.</p>
                <p>Once moment images are generated, they will be loaded and displayed in the 
                    image viewer. They are named as $data_source.$moment_keyword. For example, 
                    if moment 0, 1 and 2 images are generated from the image M51.fits, they 
                    will be named as M51.fits.moment.integrated, M51.fits.moment.weighted_coord, 
                    and M51.fits.moment.weighted_dispersion_coord, respectively. These images are 
                    kept in RAM per session and if there is a new request of moment calculations, 
                    these images will be deleted first. Optionally, calculated moment images 
                    can be exported in CASA or FITS format via 
                    &quot;File&quot; -> &quot;Save image&quot;.</p>    
            </div>
        );
    }
}
