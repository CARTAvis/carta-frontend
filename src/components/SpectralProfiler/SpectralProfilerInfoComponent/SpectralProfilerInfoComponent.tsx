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
                const colorSquare = info?.color ?
                    <div
                        style={{
                            height: '12px',
                            width: '12px',
                            margin: '0 5px 0 0',
                            background: info.color
                        }}
                    /> : null;
                return (
                    <div className="profile-legend">
                        {colorSquare}
                        <pre>{info.infoString}</pre>
                    </div>
                );
            })}
        </div>
    );
};
