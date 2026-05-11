import * as React from "react";
import {Button, Position, Radio, RadioGroup, Tooltip} from "@blueprintjs/core";

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
                <RadioGroup className="sky-ref-radio" inline={true} selectedValue={skyRefIs} onChange={event => onSkyRefIsChanged(Number(event.currentTarget.value) as SkyRefIs)}>
                    <Radio label="Origin" value={SkyRefIs.Origin} />
                    <Radio label="Pole" value={SkyRefIs.Pole} />
                </RadioGroup>
            ) : null}
            <Tooltip content={`Set ${currentReference} to current view center`} position={Position.BOTTOM} hoverOpenDelay={300}>
                <span>
                    <Button icon="locate" disabled={!isOffsetCoord} onClick={onUpdateOffsetCenter} />
                </span>
            </Tooltip>
        </div>
    );
};
