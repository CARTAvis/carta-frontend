import {observer} from "mobx-react";
import * as React from "react";
import {FormGroup, HTMLSelect, IOptionProps, NumericInput} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import {AppStore} from "stores";
import {CatalogOverlayWidgetStore, CatalogOverlayShape} from "stores/widgets";
import {ColorResult} from "react-color";
import {ColorPickerComponent} from "../../Shared";
import {SWATCH_COLORS} from "utilities";

@observer
export class CatalogOverlayPlotSettingsComponent extends React.Component<{widgetStore: CatalogOverlayWidgetStore, appStore: AppStore}> {
    private readonly MinOverlaySize = 0.5;
    private readonly MaxOverlaySize = 10;

    private handleHeaderRepresentationChange(changeEvent: any) {
        const val = changeEvent.currentTarget.value;
        this.props.widgetStore.setCatalogShape(val);
    }

    public render() {
        const appStore = this.props.appStore;
        const widgetStore = this.props.widgetStore;

        return (
            <div className="catalog-overlay-plot-settings">
                <FormGroup label={"Color"} inline={true}>
                    <ColorPickerComponent
                        color={widgetStore.catalogColor}
                        presetColors={[...SWATCH_COLORS, "transparent"]}
                        setColor={(color: ColorResult) => {
                            widgetStore.setCatalogColor(color.hex === "transparent" ? "#000000" : color.hex);
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
                            stepSize={0.5}
                            onValueChange={(value: number) => widgetStore.setCatalogSize(value)}
                    />
                </FormGroup>
            </div>
        );
    }
}