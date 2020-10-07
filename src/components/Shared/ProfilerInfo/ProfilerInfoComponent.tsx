import * as React from "react";
import "./ProfilerInfoComponent.scss";

interface ProfilerInfoComponentProps {
    info: string[];
}

export const ProfilerInfoComponent: React.FC<ProfilerInfoComponentProps> = (props) => {
    let infoTags = null;
    if (props.info && props.info.length > 0) {
        infoTags = props.info.map((infoString, index) => <tr key={index}><td><pre>{infoString}</pre></td></tr>);
    }

    return (
        <div className="profiler-info">
            <table className="info-display">
                <tbody>
                    {infoTags}
                </tbody>
            </table>
        </div>
    );
};
