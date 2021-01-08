import {observer} from "mobx-react";
import * as React from "react";
import {FormGroup, Button, MenuItem, PopoverPosition, Icon} from "@blueprintjs/core";
import {Select, IItemRendererProps} from "@blueprintjs/select";
import {AppStore} from "stores";
import {CatalogOverlayShape, CatalogWidgetStore} from "stores/widgets";
import {ColorResult} from "react-color";
import {ColorPickerComponent, SafeNumericInput} from "components/Shared";
import {SWATCH_COLORS} from "utilities";

const IconWrapper = (path: React.SVGProps<SVGPathElement>, color: string, fill: boolean, strokeWidth = 2, viewboxDefault = 16) => {
    let fillColor = color;
    if (!fill) {
        fillColor = "none";
    }
    return (
        <span className="bp3-icon">
            <svg
                data-icon="triangle-up-open"
                width="16"
                height="16"
                viewBox={`0 0 ${viewboxDefault} ${viewboxDefault}`}
                style={{stroke: color, fill: fillColor, strokeWidth: strokeWidth}}
            >
                {path}
            </svg>
        </span>
    );
};

const triangleUp = <path d="M 2 14 L 14 14 L 8 3 Z"/>;
const triangleDown = <path d="M 2 2 L 14 2 L 8 13 Z"/>;
const diamond = <path d="M 8 14 L 14 8 L 8 2 L 2 8 Z"/>;
const hexagon = <path d="M 12.33 5.5 L 12.33 10.5 L 8 13 L 3.67 10.5 L 3.67 5.5 L 8 3 Z"/>;
const hexagon2 = <path d="M 3 8 L 5.5 3.67 L 10.5 3.67 L 13 8 L 10.5 12.33 L 5.5 12.33 Z"/>;

export class CatalogOverlayPlotSettingProps {
    catalogSize: number;
    catalogColor: string;
    catalogFileId: number;
    catalogShape: CatalogOverlayShape;
    setCatalogShape: (item: CatalogOverlayShape) => void;
    setCatalogSize: (val: number) => void;
    setCatalogColor: (color: string) => void;
}

@observer
export class CatalogOverlayPlotSettingsComponent extends React.Component<CatalogOverlayPlotSettingProps> {

    private handleCatalogShapeChange = (item: CatalogOverlayShape) => {
        this.props.setCatalogShape(item);
    }

    private handleCatalogSizeChange = (val: number) => {
        this.props.setCatalogSize(val);
    }

    private handleCatalogColorChange = (color: string) => {
        this.props.setCatalogColor(color);
    }

    private renderShapePopOver = (shape: CatalogOverlayShape, itemProps: IItemRendererProps) => {
        const shapeItem = this.getCatalogShape(shape);
        return (
            <MenuItem
                icon={shapeItem}
                key={shape}
                onClick={itemProps.handleClick}
                active={itemProps.modifiers.active}
            />
        );
    }

    private getCatalogShape = (shape: CatalogOverlayShape) => {
        const color = this.props.catalogColor;
        switch (shape) {
            case CatalogOverlayShape.Circle:
                return <Icon icon="circle" color={color}/>;
            case CatalogOverlayShape.FullCircle:
                return <Icon icon="full-circle" color={color}/>;  
            case CatalogOverlayShape.Star:
                return <Icon icon="star-empty" color={color}/>;
            case CatalogOverlayShape.FullStar:
                return <Icon icon="star" color={color}/>;
            case CatalogOverlayShape.Square:
                return <Icon icon="square" color={color}/>;
            case CatalogOverlayShape.Plus:
                return <Icon icon="plus" color={color}/>;
            case CatalogOverlayShape.Cross:
                return <Icon icon="cross" color={color}/>;
            case CatalogOverlayShape.TriangleUp:
                return IconWrapper(triangleUp, color, false);
            case CatalogOverlayShape.TriangleDown:
                return IconWrapper(triangleDown, color, false);
            case CatalogOverlayShape.Diamond:
                return IconWrapper(diamond, color, false);
            case CatalogOverlayShape.hexagon:
                return IconWrapper(hexagon, color, false);
            case CatalogOverlayShape.hexagon2:
                return IconWrapper(hexagon2, color, false);
            default:
                return <Icon icon="circle" color={color}/>;
        }
    }

    public render() {
        const props = this.props;

        return (
            <div className="catalog-overlay-plot-settings">
                <FormGroup label={"Color"} inline={true}>
                    <ColorPickerComponent
                        color={props.catalogColor}
                        presetColors={[...SWATCH_COLORS, "transparent"]}
                        setColor={(color: ColorResult) => {
                            this.handleCatalogColorChange(color.hex === "transparent" ? "#000000" : color.hex);
                        }}
                        disableAlpha={true}
                        darkTheme={AppStore.Instance.darkTheme}
                    />
                </FormGroup>
                <FormGroup  inline={true} label="Shape">
                    <Select 
                        className="bp3-fill" 
                        filterable={false}
                        items={Object.values(CatalogOverlayShape)} 
                        activeItem={props.catalogShape} 
                        onItemSelect={this.handleCatalogShapeChange}
                        itemRenderer={this.renderShapePopOver}
                        popoverProps={{popoverClassName: "catalog-select", minimal: true , position: PopoverPosition.AUTO_END}}
                    >
                        <Button icon={this.getCatalogShape(props.catalogShape)} rightIcon="double-caret-vertical"/>
                    </Select>
                </FormGroup>
                <FormGroup  inline={true} label="Size" labelInfo="(px)">
                    <SafeNumericInput
                        placeholder="Catalog Size"
                        min={CatalogWidgetStore.MinOverlaySize}
                        max={CatalogWidgetStore.MaxOverlaySize}
                        value={props.catalogSize}
                        stepSize={1}
                        intOnly={true}
                        onValueChange={(value: number) => this.handleCatalogSizeChange(value)}
                    />
                </FormGroup>
            </div>
        );
    }
}