import * as React from "react";
import "./ProfilerInfoComponent.scss";

interface ProfilerInfoComponentProps {
    info: string[];
}

export const ProfilerInfoComponent: React.FC<ProfilerInfoComponentProps> = props => {
    let infoString = "";
    props.info?.forEach((info, index) => {
        infoString = index === 0 ? info : infoString + ", " + info;
    });

    return (
        <div className="profiler-info">
            <pre>{infoString}</pre>
        </div>
    );
};
