import * as React from "react";
import "./ProfilerInfoComponent.scss";

interface ProfilerInfoComponentProps {
    info: string[];
    type?: "pre-line";
    separator?: "," | "newLine";
}

export const ProfilerInfoComponent: React.FC<ProfilerInfoComponentProps> = props => {
    let infoString = "";
    props.info?.forEach((info, index) => {
        let separator = ",";
        switch (props.separator) {
            case "newLine":
                separator = "\n";
                break;
            default:
                break;
        }
        infoString = index === 0 ? info : infoString + separator + info;
    });

    return (
        <div className="profiler-info">
            <pre className={props.type === "pre-line" ? "pre-line" : "pre"}>{infoString}</pre>
        </div>
    );
};
