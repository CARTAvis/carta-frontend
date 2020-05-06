import {observer} from "mobx-react";
import * as React from "react";
import {FormGroup, NumericInput, Button, MenuItem, PopoverPosition, Icon} from "@blueprintjs/core";
import {Select, IItemRendererProps} from "@blueprintjs/select";
import {AppStore, CatalogStore, SystemType} from "stores";
import {CatalogOverlayWidgetStore, CatalogOverlayShape} from "stores/widgets";
import {ColorResult} from "react-color";
import {ColorPickerComponent} from "components/Shared";
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

@observer
export class CatalogOverlayPlotSettingsComponent extends React.Component<{widgetStore: CatalogOverlayWidgetStore, id: string}> {
    private readonly MinOverlaySize = 1;
    private readonly MaxOverlaySize = 100;

    private readonly CoordinateSystem = new Map<SystemType, string>([
        [SystemType.FK5, "FK5"],
        [SystemType.FK4, "FK4"],
        [SystemType.Galactic, "GAL"],
        [SystemType.Ecliptic, "ECL"],
        [SystemType.ICRS, "ICRS"],
    ]);

    private handleCatalogShapeChange = (item: CatalogOverlayShape) => {
        this.props.widgetStore.setCatalogShape(item);
        CatalogStore.Instance.updateCatalogShape(this.props.id, item);
    }

    private handleCatalogSizeChange(val: number) {
        this.props.widgetStore.setCatalogSize(val);
        if (val >= this.MinOverlaySize && val <= this.MaxOverlaySize) {
            CatalogStore.Instance.updateCatalogSize(this.props.id, val);
        }
    }

    private handleCatalogColorChange(color: string) {
        this.props.widgetStore.setCatalogColor(color);
        CatalogStore.Instance.updateCatalogColor(this.props.id, color);
    }

    private handleHeaderCatalogSystemChange = (system: SystemType) => {
        this.props.widgetStore.setCatalogCoordinateSystem(system);
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

    private renderSystemPopOver = (system: SystemType, itemProps: IItemRendererProps) => {
        return (
            <MenuItem
                key={system}
                text={this.CoordinateSystem.get(system)}
                onClick={itemProps.handleClick}
                active={itemProps.modifiers.active}
            />
        );
    }

    private getCatalogShape = (shape: CatalogOverlayShape) => {
        const color = this.props.widgetStore.catalogColor;
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
        const widgetStore = this.props.widgetStore;

        let systemOptions = [];
        this.CoordinateSystem.forEach((value, key) => {
            systemOptions.push(key);
        });
        const activeSystem = this.CoordinateSystem.get(widgetStore.catalogCoordinateSystem.system);

        return (
            <div className="catalog-overlay-plot-settings">
                <FormGroup  inline={true} label="System">
                    <Select 
                        className="bp3-fill"
                        filterable={false}
                        items={systemOptions} 
                        activeItem={widgetStore.catalogCoordinateSystem.system}
                        onItemSelect={this.handleHeaderCatalogSystemChange}
                        itemRenderer={this.renderSystemPopOver}
                        popoverProps={{popoverClassName: "catalog-select", minimal: true , position: PopoverPosition.AUTO_END}}
                    >
                        <Button text={activeSystem} rightIcon="double-caret-vertical"/>
                    </Select>
                </FormGroup>
                <FormGroup label={"Color"} inline={true}>
                    <ColorPickerComponent
                        color={widgetStore.catalogColor}
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
                        activeItem={widgetStore.catalogShape} 
                        onItemSelect={this.handleCatalogShapeChange}
                        itemRenderer={this.renderShapePopOver}
                        popoverProps={{popoverClassName: "catalog-select", minimal: true , position: PopoverPosition.AUTO_END}}
                    >
                        <Button icon={this.getCatalogShape(widgetStore.catalogShape)} rightIcon="double-caret-vertical"/>
                    </Select>
                </FormGroup>
                <FormGroup  inline={true} label="Size" labelInfo="(px)">
                    <NumericInput
                            placeholder="Catalog Size"
                            min={this.MinOverlaySize}
                            max={this.MaxOverlaySize}
                            value={widgetStore.catalogSize}
                            stepSize={1}
                            onValueChange={(value: number) => this.handleCatalogSizeChange(value)}
                    />
                </FormGroup>
            </div>
        );
    }
}