import * as React from "react";
import "./SpectralProfilerInfoComponent.scss";

export interface ProfileInfo {
    color?: string;
    infoString: string;
}

export const SpectralProfilerInfoComponent: React.FC<{profileInfo: ProfileInfo[]}> = (props) => {
    return (
        <div className="spectral-profiler-info">
            {props.profileInfo?.map(info => {
                return <pre>{info?.color}{info.infoString}</pre>;
            })}
        </div>
    );
};
