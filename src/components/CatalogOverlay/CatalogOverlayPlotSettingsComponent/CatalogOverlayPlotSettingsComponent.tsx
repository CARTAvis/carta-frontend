import {observer} from "mobx-react";
import * as React from "react";
import {FormGroup, HTMLSelect, NumericInput} from "@blueprintjs/core";
import {AppStore, SystemType} from "stores";
import {CatalogOverlayWidgetStore, CatalogOverlayShape} from "stores/widgets";
import {ColorResult} from "react-color";
import {ColorPickerComponent} from "components/Shared";
import {SWATCH_COLORS} from "utilities";

@observer
export class CatalogOverlayPlotSettingsComponent extends React.Component<{widgetStore: CatalogOverlayWidgetStore, appStore: AppStore, id: string}> {
    private readonly MinOverlaySize = 1;
    private readonly MaxOverlaySize = 100;

    private static readonly CoordinateSystemName = new Map<SystemType, string>([
        [SystemType.FK5, "FK5"],
        [SystemType.FK4, "FK4"],
        [SystemType.Galactic, "GAL"],
        [SystemType.Ecliptic, "ECL"],
        [SystemType.ICRS, "ICRS"],
    ]);

    private handleHeaderRepresentationChange(changeEvent: any) {
        const val = changeEvent.currentTarget.value;
        this.props.widgetStore.setCatalogShape(val);
    }

    private handleCatalogSizeChange(val: number) {
        this.props.widgetStore.setCatalogSize(val);
        if (val >= this.MinOverlaySize && val <= this.MaxOverlaySize) {
            this.props.appStore.catalogStore.updateCatalogSize(this.props.id, val);   
        }
    }

    private handleCatalogColorChange(color: string) {
        this.props.widgetStore.setCatalogColor(color);
        this.props.appStore.catalogStore.updateCatalogColor(this.props.id, color);
    }

    private handleHeaderCatalogSystemChange(changeEvent: any) {
        const val = changeEvent.currentTarget.value;
        this.props.widgetStore.setCatalogCoordinateSystem(val);
    }

    public render() {
        const appStore = this.props.appStore;
        const widgetStore = this.props.widgetStore;

        let systemOptions = [];
        CatalogOverlayPlotSettingsComponent.CoordinateSystemName.forEach((value, key) => {
            systemOptions.push(<option key={key} value={key}>{value}</option>);
        });

        return (
            <div className="catalog-overlay-plot-settings">
                <FormGroup  inline={true} label="System">
                    <HTMLSelect className="bp3-fill" value={widgetStore.catalogCoordinateSystem.system} onChange={changeEvent => this.handleHeaderCatalogSystemChange(changeEvent)}>
                        {systemOptions}
                    </HTMLSelect>
                </FormGroup>
                <FormGroup label={"Color"} inline={true}>
                    <ColorPickerComponent
                        color={widgetStore.catalogColor}
                        presetColors={[...SWATCH_COLORS, "transparent"]}
                        setColor={(color: ColorResult) => {
                            this.handleCatalogColorChange(color.hex === "transparent" ? "#000000" : color.hex);
                        }}
                        disableAlpha={true}
                        darkTheme={appStore.darkTheme}
                    />
                </FormGroup>
                <FormGroup  inline={true} label="Shape">
                    <HTMLSelect className="bp3-fill" value={widgetStore.catalogShape} onChange={changeEvent => this.handleHeaderRepresentationChange(changeEvent)}>
                        {Object.keys(CatalogOverlayShape).map(key => <option key={key} value={CatalogOverlayShape[key]}>{CatalogOverlayShape[key]}</option>)}
                    </HTMLSelect>
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