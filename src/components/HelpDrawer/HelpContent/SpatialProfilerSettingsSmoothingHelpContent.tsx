import smoothingBinning from "static/help/smoothing_binning.png";
import smoothingBinning_d from "static/help/smoothing_binning_d.png";
import smoothingBoxcar from "static/help/smoothing_boxcar.png";
import smoothingBoxcar_d from "static/help/smoothing_boxcar_d.png";
import smoothingDecimation from "static/help/smoothing_decimation.png";
import smoothingDecimation_d from "static/help/smoothing_decimation_d.png";
import smoothingGaussian from "static/help/smoothing_gaussian.png";
import smoothingGaussian_d from "static/help/smoothing_gaussian_d.png";
import smoothingHanning from "static/help/smoothing_hanning.png";
import smoothingHanning_d from "static/help/smoothing_hanning_d.png";
import smoothingSG from "static/help/smoothing_SG.png";
import smoothingSG_d from "static/help/smoothing_SG_d.png";

import {ImageComponent} from "../ImageComponent";

export const SPATIAL_PROFILER_SETTINGS_SMOOTHING_HELP_CONTENT = (
    <div>
        <h3>Smoothing</h3>
        <p>Smoothing may be applied to profiles to enhance signal-to-noise ratio. CARTA provides the following smoothing methods:</p>
        <ul>
            <li>
                <b>Boxcar</b>: convolution with a boxcar function
            </li>
            <li>
                <b>Gaussian</b>: convolution with a Gaussian function
            </li>
            <li>
                <b>Hanning</b>: convolution with a Hanning function
            </li>
            <li>
                <b>Binning</b>: averaging channels with a given width
            </li>
            <li>
                <b>Savitzky-Golay</b>: fitting successive sub-sets of adjacent data points with a low-degree polynomial by the method of linear least squares
            </li>
            <li>
                <b>Decimation</b>: min-max decimation with a given width
            </li>
        </ul>
        <p>Optionally, the original profile can be overplotted with the smoothed profile. The appearance of the smoothed profile, including color, style, width, and size, can be customized.</p>

        <h3>Examples</h3>
        <p>Boxcar: Kernel = 2</p>
        <p>
            <ImageComponent light={smoothingBoxcar} dark={smoothingBoxcar_d} width="90%" />
        </p>
        <p>Gaussian: Sigma = 1</p>
        <p>
            <ImageComponent light={smoothingGaussian} dark={smoothingGaussian_d} width="90%" />
        </p>
        <p>Hanning: Kernel = 5</p>
        <p>
            <ImageComponent light={smoothingHanning} dark={smoothingHanning_d} width="90%" />
        </p>
        <p>Binning: Binning width = 3</p>
        <p>
            <ImageComponent light={smoothingBinning} dark={smoothingBinning_d} width="90%" />
        </p>
        <p>Savitzky-Golay: Kernel = 5, Degree of fitting = 0</p>
        <p>
            <ImageComponent light={smoothingSG} dark={smoothingSG_d} width="90%" />
        </p>
        <p>Decimation: Decimation width = 3</p>
        <p>
            <ImageComponent light={smoothingDecimation} dark={smoothingDecimation_d} width="90%" />
        </p>
    </div>
);
