import React from "react";
import {Button, Icon, MenuItem, PopoverPosition} from "@blueprintjs/core";
import {IItemRendererProps, Select} from "@blueprintjs/select";
import {CARTA} from "carta-protobuf";
import {observer} from "mobx-react";

import {AppStore} from "stores";

export const PointShapeSelectComponent = observer((props: {handleChange: (pointShape: CARTA.PointAnnotationShape) => void; pointShape: CARTA.PointAnnotationShape}) => {
    const appStore = AppStore.Instance;
    const preference = appStore.preferenceStore;

    const IconWrapper = (path: React.SVGProps<SVGPathElement>, color: string, fill: boolean, strokeWidth = 2, viewboxDefault = 16) => {
        let fillColor = color;
        if (!fill) {
            fillColor = "none";
        }
        return (
            <span className="bp3-icon">
                <svg data-icon="triangle-up-open" width="16" height="16" viewBox={`0 0 ${viewboxDefault} ${viewboxDefault}`} style={{stroke: color, fill: fillColor, strokeWidth: strokeWidth}}>
                    {path}
                </svg>
            </span>
        );
    };

    const renderShapePopOver = (shape: CARTA.PointAnnotationShape, itemProps: IItemRendererProps) => {
        const shapeItem = getPointShape(shape);
        return <MenuItem icon={shapeItem} key={shape} onClick={itemProps.handleClick} active={itemProps.modifiers.active} />;
    };

    const getPointShape = (shape: CARTA.PointAnnotationShape) => {
        const square = <path d="M 2 2 L 14 2 L 14 14 L 2 14 Z" />;
        const rhomb = <path d="M 8 14 L 14 8 L 8 2 L 2 8 Z" />;
        const color = preference.annotationColor;
        switch (shape) {
            case CARTA.PointAnnotationShape.SQUARE:
                return IconWrapper(square, color, true);
            case CARTA.PointAnnotationShape.BOX:
                return <Icon icon="square" color={color} />;
            case CARTA.PointAnnotationShape.CIRCLE:
                return <Icon icon="full-circle" color={color} />;
            case CARTA.PointAnnotationShape.CIRCLE_LINED:
                return <Icon icon="circle" color={color} />;
            case CARTA.PointAnnotationShape.DIAMOND:
                return IconWrapper(rhomb, color, true);
            case CARTA.PointAnnotationShape.DIAMOND_LINED:
                return IconWrapper(rhomb, color, false);
            case CARTA.PointAnnotationShape.CROSS:
                return <Icon icon="plus" color={color} />;
            case CARTA.PointAnnotationShape.X:
                return <Icon icon="cross" color={color} />;
            default:
                return <Icon icon="square" color={color} />;
        }
    };

    return (
        <Select
            className="bp3-fill"
            filterable={false}
            items={Object.values(CARTA.PointAnnotationShape)}
            activeItem={preference.pointAnnotationShape}
            onItemSelect={item => props.handleChange(item as CARTA.PointAnnotationShape)}
            itemRenderer={renderShapePopOver}
            popoverProps={{popoverClassName: "catalog-select", minimal: true, position: PopoverPosition.AUTO_END}}
        >
            <Button icon={getPointShape(props.pointShape)} rightIcon="double-caret-vertical" />
        </Select>
    );
});
