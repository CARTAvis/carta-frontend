import * as React from "react";
import "./SpectralProfilerInfoComponent.scss";

interface SpectralProfilerInfoComponentProps {
    info: string[];
}

export const SpectralProfilerInfoComponent: React.FC<SpectralProfilerInfoComponentProps> = (props) => {
    let infoString = "";
    props.info?.forEach((info, index) => {
        infoString = index === 0 ? info : (infoString + ", " + info);
    });

    return (
        <div className="spectral-profiler-info">
            <pre>{infoString}</pre>
        </div>
    );
};
