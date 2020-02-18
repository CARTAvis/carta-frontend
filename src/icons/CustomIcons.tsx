import * as React from "react";
import { Icon } from "@blueprintjs/core";

export declare type CustomIconName = "contour";

export class CustomIcon extends React.Component<{icon: CustomIconName, size?: number }> {
    static readonly SIZE_STANDARD = 16;
    static readonly SIZE_LARGE = 20;

    public render() {
        const size = (this.props.size ? this.props.size : CustomIcon.SIZE_STANDARD) + "px";
        const content = (
            <span className="bp3-icon">
                <svg width={size} height={size} viewBox="0 0 16 16">
                    {icons[this.props.icon]}
                </svg>
            </span>
        );
        return <Icon icon={content} />;
    }
}

// copy content of tag <path/> in svg, and turn attributes fill-rule/clip-rule into fillRule/clipRule.
const contourSvg = (
    <path  
        fillRule="evenodd" 
        clipRule="evenodd" 
        d="M 13.3086,13.326331 A 7.489923,8.4952736 45 0 1 2.0053593,14.037221 7.489923,8.4952736 45 0 1 2.7162497,2.7339802 7.489923,8.4952736 45 0 1 14.01949,2.02309 7.489923,8.4952736 45 0 1 13.3086,13.326331 Z
        M 13.148613,12.347604 A 6.6468272,7.6124401 40 0 1 3.1636657,13.906573 6.6468272,7.6124401 40 0 1 2.9650831,3.8026076 6.6468272,7.6124401 40 0 1 12.95003,2.2436383 6.6468272,7.6124401 40 0 1 13.148613,12.347604 Z
        M 10.882979,12.264102 A 4.8685541,5.7219758 50 0 1 3.3702451,12.212588 4.8685541,5.7219758 50 0 1 4.6240863,4.8050444 4.8685541,5.7219758 50 0 1 12.136821,4.8565581 4.8685541,5.7219758 50 0 1 10.882979,12.264102 Z
        M 10.33713,11.668778 A 4.0524521,4.8181229 50 0 1 4.0413674,11.66145 4.0524521,4.8181229 50 0 1 5.1273981,5.4600614 4.0524521,4.8181229 50 0 1 11.42316,5.4673901 4.0524521,4.8181229 50 0 1 10.33713,11.668778 Z
        M 7.9142814,10.852556 A 2.047241,2.547725 60 0 1 4.6842662,10.353456 2.047241,2.547725 60 0 1 5.8670405,7.3066306 2.047241,2.547725 60 0 1 9.0970556,7.8057308 2.047241,2.547725 60 0 1 7.9142814,10.852556 Z
        M 7.5029842,10.217581 A 1.2341059,1.684913 60 0 1 5.426754,9.9912708 1.2341059,1.684913 60 0 1 6.2688783,8.0800472 1.2341059,1.684913 60 0 1 8.3451088,8.3063578 1.2341059,1.684913 60 0 1 7.5029842,10.217581 Z"
    />
);

const icons = {
    contour: contourSvg,
};
