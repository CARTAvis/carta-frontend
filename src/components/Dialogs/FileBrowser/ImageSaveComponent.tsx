import * as React from "react";
import {observer} from "mobx-react";
import {Text, Label, FormGroup, IOptionProps, HTMLSelect, ControlGroup, Switch, NumericInput, Intent} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import {AppStore, FileBrowserStore} from "stores";
import {SpectralSystem, SpectralType, SpectralUnit} from "models";
import "./ImageSaveComponent.scss";
import {action, autorun, computed, makeObservable} from "mobx";

@observer
export class ImageSaveComponent extends React.Component {
    constructor(props: any) {
        super(props);
        makeObservable(this);

        autorun(()=>{
            const appStore = AppStore.Instance;
            if (this.validSaveSpectralRangeStart && this.validSaveSpectralRangeEnd) {
                appStore.endFileSaving()
            } else {
                appStore.startFileSaving();
            }
        })
    }

    @computed get validSaveSpectralRangeStart() {
        const appStore = AppStore.Instance;
        const fileBrowser = FileBrowserStore.Instance;
        const spectralRange = appStore.activeFrame?.channelValueBounds;
        if (spectralRange && fileBrowser.saveSpectralRange?.length) {
            const valueAsNumber = parseFloat(fileBrowser.saveSpectralRange[0]);
            return spectralRange.min <= valueAsNumber && valueAsNumber <= parseFloat(fileBrowser.saveSpectralRange[1]);
        }
        return false;
    }

    @computed get validSaveSpectralRangeEnd() {
        const appStore = AppStore.Instance;
        const fileBrowser = FileBrowserStore.Instance;
        const spectralRange = appStore.activeFrame?.channelValueBounds;
        if (spectralRange && fileBrowser.saveSpectralRange?.length) {
            const valueAsNumber = parseFloat(fileBrowser.saveSpectralRange[1]);
            return parseFloat(fileBrowser.saveSpectralRange[0]) <= valueAsNumber && valueAsNumber <= spectralRange.max;
        }
        return false;
    }

    private onChangeShouldDropDegenerateAxes = () => {
        const fileBrowser = FileBrowserStore.Instance;
        fileBrowser.shouldDropDegenerateAxes = !fileBrowser.shouldDropDegenerateAxes;
    };

    private handleRegionChanged = (changeEvent: React.ChangeEvent<HTMLSelectElement>) => {
        const fileBrowser = FileBrowserStore.Instance;
        fileBrowser.setSaveRegionId(parseInt(changeEvent.target.value));
    };

    private handleSaveSpectralRangeStartChanged = (_valueAsNumber: number, valueAsString: string) => {
        const fileBrowser = FileBrowserStore.Instance;
        if (FileBrowserStore) {
            fileBrowser.setSaveSpectralRangeMin(valueAsString);
        }
    };

    private handleSaveSpectralRangeEndChanged = (_valueAsNumber: number, valueAsString: string) => {
        const fileBrowser = FileBrowserStore.Instance;
        if (FileBrowserStore) {
            fileBrowser.setSaveSpectralRangeMax(valueAsString);
        }
    };

    @action updateSpectralCoordinate(coordStr: string): void {
        const activeFrame = AppStore.Instance.activeFrame;
        if (activeFrame?.spectralCoordsSupported?.has(coordStr)) {
            const coord: { type: SpectralType, unit: SpectralUnit } = activeFrame.spectralCoordsSupported.get(coordStr);
            activeFrame.spectralType = coord.type;
            activeFrame.spectralUnit = coord.unit;
            // Update the spectral range
            FileBrowserStore.Instance.initialSaveSpectralRange();
        }
    };

    @action updateSpectralSystem(specsys: SpectralSystem): void {
        const activeFrame = AppStore.Instance.activeFrame;
        if (activeFrame?.spectralSystemsSupported?.includes(specsys)) {
            activeFrame.spectralSystem = specsys;
            // Update the spectral range
            FileBrowserStore.Instance.initialSaveSpectralRange();
        }
    };

    @action updateStokes(option: number): void {
        FileBrowserStore.Instance.saveStokesOption = option;
    };

    /// Generate options for stokes via string
    @computed get stokesOptions() {
        const activeFrame = AppStore.Instance.activeFrame;
        const stokesInfo = activeFrame.stokesInfo;
        let options = [
            { value: 0, label: stokesInfo.join("") },
        ];
        const optionsAddFourElements = () => {
            options.push({ value: 4, label: stokesInfo[3] });
            options.push({ value: 7, label: stokesInfo.slice(2, 4).join("") });
            options.push({ value: 9, label: stokesInfo[0] + stokesInfo[3] });
            options.push({ value: 10, label: stokesInfo[1] + stokesInfo[3] });
            options.push({ value: 11, label: stokesInfo.slice(0, 3).join("") });
            options.push({ value: 12, label: stokesInfo.slice(1, 4).join("") });
        };
        const optionsAddThreeElements = () => {
            options.push({ value: 3, label: stokesInfo[2] });
            options.push({ value: 5, label: stokesInfo.slice(0, 2).join("") });
            options.push({ value: 6, label: stokesInfo.slice(1, 3).join("") });
            options.push({ value: 8, label: stokesInfo[0] + stokesInfo[2] });
        };
        const optionsAddTwoElements = () => {
            options.push({ value: 1, label: stokesInfo[0] });
            options.push({ value: 2, label: stokesInfo[1] });
        };
        if (activeFrame) {
            switch (stokesInfo.join("")) {
                case "IQUV":
                    optionsAddFourElements();
                    optionsAddThreeElements();
                    optionsAddTwoElements();
                    break;
                case "IQU":
                case "QUV":
                    optionsAddThreeElements();
                    optionsAddTwoElements();
                    break;
                case "IQ":
                case "IU":
                case "IV":
                case "QU":
                case "QV":
                case "UV":
                    optionsAddTwoElements();
                    break;
                default:
                    break;
            }
            return options.sort((a, b) => a.value - b.value);
        }
        return [];
    };

    private renderSaveImageControl() {
        const fileBrowser = FileBrowserStore.Instance;
        const activeFrame = AppStore.Instance.activeFrame;
        const closedRegions = activeFrame.regionSet?.regions.filter(region => region.regionId > 0 && region.isClosedRegion);
        const regionOptions: IOptionProps[] = [{ value: 0, label: "Image" }].concat(closedRegions.map(region => ({ value: region.regionId, label: `${region.name ? region.name : region.regionId} (${CARTA.RegionType[region.regionType]})` })));
        // Global value of Spectral Coordinate System and Unit
        const nativeSpectralCoordinate = activeFrame ? activeFrame.nativeSpectralCoordinate : undefined;
        const spectralCoordinateOptions: IOptionProps[] = activeFrame && activeFrame.spectralCoordsSupported ?
            Array.from(activeFrame.spectralCoordsSupported.keys()).map((coord: string) => { return { value: coord, label: coord === nativeSpectralCoordinate ? coord + " (Native WCS)" : coord }; }) : [];
        const spectralSystemOptions: IOptionProps[] = activeFrame && activeFrame.spectralSystemsSupported ? activeFrame.spectralSystemsSupported.map(system => { return { value: system, label: system }; }) : [];
        const stokesOptions: IOptionProps[] = this.stokesOptions;
        // Calculate a small step size
        const numChannels = activeFrame.numChannels;
        const min = activeFrame.channelValueBounds?.min;
        const max = activeFrame.channelValueBounds?.max;
        const delta = numChannels > 1 ? Math.abs(max - min) / (numChannels - 1) : Math.abs(max - min);
        const majorStepSize = delta * 0.1;
        return (
            <React.Fragment>
                {activeFrame &&
                    <div className="file-save">
                        <ControlGroup className="file-name" vertical={false}>
                            <Label className="label">{"Source"}</Label>
                            <Text className="text" ellipsize={true} title={activeFrame.frameInfo.fileInfo.name}>
                                {activeFrame.frameInfo.fileInfo.name}
                            </Text>
                        </ControlGroup>
                        <ControlGroup className="region-select" vertical={false}>
                            <Label className="label">{"Region"}</Label>
                            <HTMLSelect
                                value={fileBrowser.saveRegionId}
                                onChange={this.handleRegionChanged}
                                options={regionOptions}
                            />
                        </ControlGroup>
                        {numChannels > 1 &&
                            <React.Fragment>
                                <div className="coordinate-select">
                                    <FormGroup label={"Range unit"} inline={true} >
                                        <HTMLSelect
                                            value={activeFrame && (activeFrame.spectralCoordinate || "")}
                                            options={spectralCoordinateOptions}
                                            onChange={
                                                (event: React.FormEvent<HTMLSelectElement>) =>
                                                    this.updateSpectralCoordinate(event.currentTarget.value as string)
                                            }
                                        />
                                        <HTMLSelect
                                            value={activeFrame && (activeFrame.spectralSystem || "")}
                                            options={spectralSystemOptions}
                                            onChange={
                                                (event: React.FormEvent<HTMLSelectElement>) =>
                                                    this.updateSpectralSystem(event.currentTarget.value as SpectralSystem)
                                            }
                                        />
                                    </FormGroup>
                                </div>
                                <div className="range-select">
                                    <ControlGroup>
                                        <Label>{"Range from"}</Label>
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
                                    </ControlGroup>
                                    <ControlGroup>
                                        <Label>{"Range to"}</Label>
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
                                    </ControlGroup>
                                </div>
                            </React.Fragment>
                        }
                        {activeFrame.hasStokes &&
                            <React.Fragment>
                                <div className="stokes-select">
                                    <FormGroup label={"Stokes"} inline={true}>
                                        <HTMLSelect
                                            value={fileBrowser.saveStokesOption || ""}
                                            options={stokesOptions}
                                            onChange={
                                                (event: React.FormEvent<HTMLSelectElement>) =>
                                                    this.updateStokes(parseInt(event.currentTarget.value))
                                            }
                                        />
                                    </FormGroup>
                                </div>
                            </React.Fragment>
                        }
                        <Switch
                            className="drop-degenerate"
                            checked={fileBrowser.shouldDropDegenerateAxes}
                            label="Drop degenerate axes"
                            onChange={this.onChangeShouldDropDegenerateAxes}
                        />
                    </div>
                }
            </React.Fragment>
        );
    }

    render() {
        return (
            this.renderSaveImageControl()
        );
    }
}
