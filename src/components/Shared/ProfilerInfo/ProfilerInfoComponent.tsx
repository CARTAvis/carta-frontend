import * as React from "react";
import "./ProfilerInfoComponent.scss";

interface ProfilerInfoComponentProps {
    info: string[];
    type?: "pre-line";
}

export const ProfilerInfoComponent: React.FC<ProfilerInfoComponentProps> = props => {
    let infoString = "";
    props.info?.forEach((info, index) => {
        infoString = index === 0 ? info : infoString + ", " + info;
    });

    return (
        <div className="profiler-info">
            <pre className={props.type === "pre-line" ? "pre-line" : "pre"}>{infoString}</pre>
        </div>
    );
};
