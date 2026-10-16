import * as AST from "ast_wrapper";

import {type Point2D} from "models";

export function getRulerDistanceText(wcsInfo: AST.FrameSet, start: Point2D, finish: Point2D, decimals: number): string {
    const distance = ((AST.geodesicDistance(wcsInfo, start.x, start.y, finish.x, finish.y) / 3600) * Math.PI) / 180;
    const unit = AST.getString(wcsInfo, "Unit(1)");
    if (unit.includes("degree") || unit.includes("hh:mm:s")) {
        if (distance < Math.PI / 180 / 60) return `${(((distance * 180) / Math.PI) * 3600).toFixed(decimals)}"`;
        if (distance < Math.PI / 180) return `${(((distance * 180) / Math.PI) * 60).toFixed(decimals)}'`;
        return `${((distance * 180) / Math.PI).toFixed(decimals)}°`;
    }
    return `${distance.toFixed(decimals)}${!unit || unit[0] === "\0" || unit.trim() === "" ? "pix" : ""}`;
}
