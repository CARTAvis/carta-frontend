import * as React from "react";
import {observer} from "mobx-react";
import {action, autorun, computed, makeObservable} from "mobx";
import {Text, Label, FormGroup, IOptionProps, HTMLSelect, Switch, NumericInput, Intent} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import {AppStore, FileBrowserStore} from "stores";
import {FrequencyUnit, SpectralSystem} from "models";
import {ClearableNumericInputComponent} from "components/Shared";
import "./ImageSaveComponent.scss";

@observer
export class ImageSaveComponent extends React.Component {
    constructor(props: any) {
        super(props);
        makeObservable(this);

        autorun(() => {
            const appStore = AppStore.Instance;
            if (appStore.activeFrame?.numChannels <= 1 || (this.validSaveSpectralRangeStart && this.validSaveSpectralRangeEnd)) {
                appStore.endFileSaving();
            } else {
                appStore.startFileSaving();
            }
        });
    }

    @computed get validSaveSpectralRangeStart() {
        const appStore = AppStore.Instance;
        const fileBrowser = FileBrowserStore.Instance;
        const spectralRange = appStore.activeFrame?.channelValueBounds;
        const valueAsNumber = parseFloat(fileBrowser.saveSpectralRange[0]);
        return spectralRange?.min <= valueAsNumber && valueAsNumber <= parseFloat(fileBrowser.saveSpectralRange[1]);
    }

    @computed get validSaveSpectralRangeEnd() {
        const appStore = AppStore.Instance;
        const fileBrowser = FileBrowserStore.Instance;
        const spectralRange = appStore.activeFrame?.channelValueBounds;
        const valueAsNumber = parseFloat(fileBrowser.saveSpectralRange[1]);
        return parseFloat(fileBrowser.saveSpectralRange[0]) <= valueAsNumber && valueAsNumber <= spectralRange?.max;
    }

    private onChangeShouldDropDegenerateAxes = () => {
        const fileBrowser = FileBrowserStore.Instance;
        fileBrowser.shouldDropDegenerateAxes = !fileBrowser.shouldDropDegenerateAxes;
    };

    private handleRegionChanged = (changeEvent: React.ChangeEvent<HTMLSelectElement>) => {
        FileBrowserStore.Instance?.setSaveRegionId(parseInt(changeEvent.target.value));
    };

    private handleSaveSpectralRangeStartChanged = (_valueAsNumber: number, valueAsString: string) => {
        FileBrowserStore.Instance?.setSaveSpectralRangeMin(valueAsString);
    };

    private handleSaveSpectralRangeEndChanged = (_valueAsNumber: number, valueAsString: string) => {
        FileBrowserStore.Instance?.setSaveSpectralRangeMax(valueAsString);
    };

    updateSpectralCoordinate(coordStr: string): void {
        const activeFrame = AppStore.Instance.activeFrame;
        if (activeFrame?.setSpectralCoordinate(coordStr)) {
            FileBrowserStore.Instance.initialSaveSpectralRange();
        }
    }

    updateSpectralSystem(specsys: SpectralSystem): void {
        const activeFrame = AppStore.Instance.activeFrame;
        if (activeFrame?.setSpectralSystem(specsys)) {
            FileBrowserStore.Instance.initialSaveSpectralRange();
        }
    }

    @action updateStokes(option: number): void {
        FileBrowserStore.Instance.saveStokesOption = option;
    }

    /// Generate options for stokes via string
    @computed get stokesOptions() {
        const stokesInfo = AppStore.Instance.activeFrame?.stokesInfo;

        if (stokesInfo) {
            let options = [];
            const addOption = (value: number, stokesInfoList: string[]) => {
                options.push({value: value, label: stokesInfoList.join(", ").replace(/, Stokes/g, ", ")});
            };

            const optionsAddFourElements = () => {
                addOption(4, [stokesInfo[3]]);
                addOption(7, stokesInfo.slice(2, 4));
                addOption(9, [stokesInfo[0], stokesInfo[3]]);
                addOption(10, [stokesInfo[1], stokesInfo[3]]);
                addOption(11, stokesInfo.slice(0, 3));
                addOption(12, stokesInfo.slice(1, 4));
            };
            const optionsAddThreeElements = () => {
                addOption(3, [stokesInfo[2]]);
                addOption(5, stokesInfo.slice(0, 2));
                addOption(6, stokesInfo.slice(1, 3));
                addOption(8, [stokesInfo[0], stokesInfo[2]]);
            };
            const optionsAddTwoElements = () => {
                addOption(1, [stokesInfo[0]]);
                addOption(2, [stokesInfo[1]]);
            };

            addOption(0, stokesInfo);
            switch (stokesInfo.length) {
                case 4:
                    optionsAddFourElements();
                    optionsAddThreeElements();
                    optionsAddTwoElements();
                    break;
                case 3:
                    optionsAddThreeElements();
                    optionsAddTwoElements();
                    break;
                case 2:
                    optionsAddTwoElements();
                    break;
                default:
                    break;
            }

            return options.sort((a, b) => a.value - b.value);
        }
        return [];
    }

    render() {
        const fileBrowser = FileBrowserStore.Instance;
        const activeFrame = AppStore.Instance.activeFrame;
        const closedRegions = activeFrame?.regionSet?.regions.filter(region => region.regionId > 0 && region.isClosedRegion);
        const regionOptions: IOptionProps[] = [{value: 0, label: "Image"}].concat(
            closedRegions?.map(region => ({
                value: region.regionId,
                label: `${region.name ? region.name : region.regionId} (${CARTA.RegionType[region.regionType]})`
            }))
        );
        // Global value of Spectral Coordinate System and Unit
        const nativeSpectralCoordinate = activeFrame ? activeFrame.nativeSpectralCoordinate : undefined;
        const spectralCoordinateOptions: IOptionProps[] =
            activeFrame && activeFrame.spectralCoordsSupported
                ? Array.from(activeFrame.spectralCoordsSupported.keys()).map((coord: string) => {
                      return {value: coord, label: coord === nativeSpectralCoordinate ? coord + " (Native WCS)" : coord};
                  })
                : [];
        const spectralSystemOptions: IOptionProps[] =
            activeFrame && activeFrame.spectralSystemsSupported
                ? activeFrame.spectralSystemsSupported.map(system => {
                      return {value: system, label: system};
                  })
                : [];
        // Calculate a small step size
        const numChannels = activeFrame?.numChannels;
        const min = activeFrame?.channelValueBounds?.min ?? 0;
        const max = activeFrame?.channelValueBounds?.max ?? 1;
        const delta = numChannels > 1 ? Math.abs(max - min) / (numChannels - 1) : Math.abs(max - min);
        const majorStepSize = delta * 0.1;
        return (
            <React.Fragment>
                {activeFrame && (
                    <div className="file-save">
                        <FormGroup className="file-name" label={"Source"} inline={true}>
                            <Text className="text" ellipsize={true} title={activeFrame.frameInfo.fileInfo.name}>
                                {activeFrame.frameInfo.fileInfo.name}
                            </Text>
                        </FormGroup>
                        <FormGroup className="region-select" label={"Region"} inline={true}>
                            <HTMLSelect value={fileBrowser.saveRegionId} onChange={this.handleRegionChanged} options={regionOptions} />
                        </FormGroup>
                        {numChannels > 1 && (
                            <React.Fragment>
                                <div className="coordinate-select">
                                    <FormGroup label={"Range unit"} inline={true}>
                                        <HTMLSelect
                                            value={activeFrame && (activeFrame.spectralCoordinate || "")}
                                            options={spectralCoordinateOptions}
                                            onChange={(event: React.FormEvent<HTMLSelectElement>) => this.updateSpectralCoordinate(event.currentTarget.value as string)}
                                        />
                                        <HTMLSelect
                                            value={activeFrame && (activeFrame.spectralSystem || "")}
                                            options={spectralSystemOptions}
                                            onChange={(event: React.FormEvent<HTMLSelectElement>) => this.updateSpectralSystem(event.currentTarget.value as SpectralSystem)}
                                        />
                                    </FormGroup>
                                </div>
                                <div className="range-select">
                                    <FormGroup label={"Range from"} inline={true}>
                                        <NumericInput
                                            value={fileBrowser.saveSpectralRange[0]}
                                            buttonPosition="none"
                                            placeholder="First channel"
                                            onValueChange={this.handleSaveSpectralRangeStartChanged}
                                            majorStepSize={null}
                                            stepSize={majorStepSize}
                                            minorStepSize={null}
                                            selectAllOnIncrement={true}
                                            intent={this.validSaveSpectralRangeStart ? Intent.NONE : Intent.DANGER}
                                        />
                                        <Label>{activeFrame.spectralUnit ? `(${activeFrame.spectralUnit})` : ""}</Label>
                                    </FormGroup>
                                    <FormGroup label={"Range to"} inline={true}>
                                        <NumericInput
                                            value={fileBrowser.saveSpectralRange[1]}
                                            buttonPosition="none"
                                            placeholder="Last channel"
                                            onValueChange={this.handleSaveSpectralRangeEndChanged}
                                            majorStepSize={null}
                                            stepSize={majorStepSize}
                                            minorStepSize={null}
                                            selectAllOnIncrement={true}
                                            intent={this.validSaveSpectralRangeEnd ? Intent.NONE : Intent.DANGER}
                                        />
                                        <Label>{activeFrame.spectralUnit ? `(${activeFrame.spectralUnit})` : ""}</Label>
                                    </FormGroup>
                                </div>
                            </React.Fragment>
                        )}
                        {activeFrame.hasStokes && (
                            <div className="stokes-select">
                                <FormGroup label={"Polarization"} inline={true}>
                                    <HTMLSelect value={fileBrowser.saveStokesOption || ""} options={this.stokesOptions} onChange={(event: React.FormEvent<HTMLSelectElement>) => this.updateStokes(parseInt(event.currentTarget.value))} />
                                </FormGroup>
                            </div>
                        )}
                        {activeFrame.isRestFreqEditable && (
                            <div className="freq-input">
                                <ClearableNumericInputComponent
                                    label="Rest frequency"
                                    value={fileBrowser.saveRestFreq.value}
                                    placeholder="rest frequency"
                                    selectAllOnFocus={true}
                                    onValueChanged={fileBrowser.setSaveRestFreqVal}
                                    onValueCleared={fileBrowser.resetSaveRestFreq}
                                    resetDisabled={activeFrame.restFreqStore.resetDisable}
                                    tooltipContent={activeFrame.restFreqStore.defaultInfo}
                                    tooltipPlacement={"bottom"}
                                />
                                <HTMLSelect options={Object.values(FrequencyUnit)} value={fileBrowser.saveRestFreq.unit} onChange={ev => fileBrowser.setSaveRestFreqUnit(ev.currentTarget.value as FrequencyUnit)} />
                            </div>
                        )}
                        <Switch className="drop-degenerate" checked={fileBrowser.shouldDropDegenerateAxes} label="Drop degenerate axes" onChange={this.onChangeShouldDropDegenerateAxes} />
                    </div>
                )}
            </React.Fragment>
        );
    }
}
