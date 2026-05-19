import * as React from "react";
import {Button, ButtonGroup, Position, Tooltip} from "@blueprintjs/core";

import {SkyRefIs} from "enums";

import "./OffsetCoordinateControlsComponent.scss";

export interface OffsetCoordinateControlsProps {
    className?: string;
    isWcsCoordinates: boolean;
    isOffsetCoord: boolean;
    skyRefIs: SkyRefIs;
    onSkyRefIsChanged: (value: SkyRefIs) => void;
    onUpdateOffsetCenter: () => void;
}

export const OffsetCoordinateControlsComponent = ({className, isWcsCoordinates, isOffsetCoord, skyRefIs, onSkyRefIsChanged, onUpdateOffsetCenter}: OffsetCoordinateControlsProps): React.ReactElement => {
    const currentReference = isWcsCoordinates && skyRefIs === SkyRefIs.Pole ? "pole" : "reference point";
    const containerClassName = className ? `offset-coordinate-controls ${className}` : "offset-coordinate-controls";

    return (
        <div className={containerClassName}>
            {isWcsCoordinates ? (
                <ButtonGroup className="sky-ref-buttons">
                    <Button small={true} active={skyRefIs === SkyRefIs.Origin} onClick={() => onSkyRefIsChanged(SkyRefIs.Origin)}>
                        Origin
                    </Button>
                    <Button small={true} active={skyRefIs === SkyRefIs.Pole} onClick={() => onSkyRefIsChanged(SkyRefIs.Pole)}>
                        Pole
                    </Button>
                </ButtonGroup>
            ) : null}
            <Tooltip content={`Set ${currentReference} to current view center`} position={Position.BOTTOM} hoverOpenDelay={300}>
                <span>
                    <Button className="offset-recenter-button" icon="locate" aria-label={`Set ${currentReference} to current view center`} disabled={!isOffsetCoord} onClick={onUpdateOffsetCenter} />
                </span>
            </Tooltip>
        </div>
    );
};
