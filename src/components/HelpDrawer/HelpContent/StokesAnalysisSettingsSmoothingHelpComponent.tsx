import * as React from "react";

export class StokesAnalysisSettingsSmoothingHelpComponent extends React.Component {
    public render() {
        return (
            <div>
                <h3>Smoothing</h3>
                <p>Smoothing may be applied to profiles to enhance signal-to-noise 
                    ratio. CARTA provides the following smoothing methods:</p>
                <ul>
                    <li><b>Boxcar</b>: convolution with a boxcar function</li>
                    <li><b>Gaussian</b>: convolution with a Gaussian function</li>
                    <li><b>Hanning</b>: convolution with a Hanning function</li>
                    <li><b>Binning</b>: averaging channels with a given width</li>
                    <li><b>Savitzky-Golay</b>: fitting successive sub-sets of adjacent 
                        data points with a low-degree polynomial by the method 
                        of linear least squares</li>
                    <li><b>Decimation</b>: min-max decimation with a given width</li>    
                </ul>
                <p>Optionally, the original profile can be overplotted with the 
                    smoothed profile. The appearance of the smoothed profile, 
                    including color, style, width, and size, can be customized.</p>
                <p>The data of the smoothed profile is appended in the exported 
                    tsv file if a smooth method is applied.</p>    
            </div>
        );
    }
}
