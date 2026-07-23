import * as React from "react";
import {FormGroup, H3, HTMLSelect, Icon, InputGroup, Intent, MenuItem, Switch, Tab, Tabs} from "@blueprintjs/core";
import {type ItemPredicate, type ItemRenderer, Suggest} from "@blueprintjs/select";
import {observer} from "mobx-react";

import {SafeNumericInput, ScrollShadow} from "components/Shared";
import {AnimationMode, HelpType, IsoTimePrecision, RelativeTimeReference, RelativeTimeUnit, TimeLabelFormat, TimeScale, TimeZoneMode} from "enums";
import {type AnimatorWidgetStore, AppStore, type DefaultWidgetConfig, type WidgetProps, WidgetsStore} from "stores";
import {convertMjdToUtc, convertMjdUtcToScale, formatMjdUtcAsIsoInScale, getTimeSeriesTickLabelResult, isValidIanaTimeZone, parseIsoInScaleToMjdUtc} from "utilities";

import "./AnimatorSettingsPanelComponent.scss";

const TIME_LABEL_FORMAT_OPTIONS = [
    {value: TimeLabelFormat.AUTO, label: "Automatic (compact UTC)"},
    {value: TimeLabelFormat.ISO, label: "ISO 8601"},
    {value: TimeLabelFormat.MJD, label: "Modified Julian Date (MJD)"},
    {value: TimeLabelFormat.JD, label: "Julian Date (JD)"},
    {value: TimeLabelFormat.RELATIVE, label: "Relative"}
];

const TIME_ZONE_OPTIONS = [
    {value: TimeZoneMode.UTC, label: "UTC"},
    {value: TimeZoneMode.LOCAL, label: "Browser local time"},
    {value: TimeZoneMode.IANA, label: "Custom IANA time zone"}
];

const TIME_SCALE_OPTIONS = Object.values(TimeScale).map(value => ({value, label: value}));

const BROWSER_IANA_TIME_ZONE: string = (() => {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || "Unavailable";
    } catch {
        return "Unavailable";
    }
})();

const IANA_TIME_ZONES = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [];

const DEFAULT_CUSTOM_IANA_TIME_ZONE = IANA_TIME_ZONES.includes(BROWSER_IANA_TIME_ZONE) ? BROWSER_IANA_TIME_ZONE : "Asia/Taipei";

const FilterTimeZone: ItemPredicate<string> = (query, timeZone, _index, isExactMatch) => {
    const normalizedTimeZone = timeZone.toLowerCase();
    const normalizedQuery = query.toLowerCase();

    if (isExactMatch) {
        return normalizedTimeZone === normalizedQuery;
    }
    return normalizedTimeZone.includes(normalizedQuery);
};

const RenderTimeZoneOption: ItemRenderer<string> = (timeZone, {handleClick, handleFocus, modifiers}) => {
    if (!modifiers.matchesPredicate) {
        return null;
    }
    return <MenuItem key={timeZone} text={timeZone} active={modifiers.active} disabled={modifiers.disabled} onClick={handleClick} onFocus={handleFocus} />;
};

const ISO_PRECISION_OPTIONS = [
    {value: IsoTimePrecision.AUTO, label: "Automatic"},
    {value: IsoTimePrecision.YEAR, label: "Years"},
    {value: IsoTimePrecision.MONTH, label: "Months"},
    {value: IsoTimePrecision.DAY, label: "Days"},
    {value: IsoTimePrecision.HOUR, label: "Hours"},
    {value: IsoTimePrecision.MINUTE, label: "Minutes"},
    {value: IsoTimePrecision.SECOND, label: "Seconds"},
    {value: IsoTimePrecision.MILLISECOND, label: "Milliseconds"},
    {value: IsoTimePrecision.MICROSECOND, label: "Microseconds"}
];

const NUMERIC_PRECISION_OPTIONS = [{value: "auto", label: "Automatic"}, ...Array.from({length: 10}, (_, value) => ({value: value.toString(), label: value.toString()}))];

const RELATIVE_REFERENCE_OPTIONS = [
    {value: RelativeTimeReference.FIRST, label: "First observation"},
    {value: RelativeTimeReference.IMAGE, label: "Time-series image"},
    {value: RelativeTimeReference.CUSTOM, label: "Custom epoch"}
];

const RELATIVE_UNIT_OPTIONS = [
    {value: RelativeTimeUnit.AUTO, label: "Automatic"},
    {value: RelativeTimeUnit.SECOND, label: "Seconds"},
    {value: RelativeTimeUnit.MINUTE, label: "Minutes"},
    {value: RelativeTimeUnit.HOUR, label: "Hours"},
    {value: RelativeTimeUnit.DAY, label: "Days"},
    {value: RelativeTimeUnit.YEAR, label: "Years"}
];

interface AnimatorSettingsPanelState {
    relativeReferenceIsoDraft: string | null;
    relativeReferenceIsoInvalid: boolean;
}

@observer
export class AnimatorSettingsPanelComponent extends React.Component<WidgetProps, AnimatorSettingsPanelState> {
    public static get WidgetConfig(): DefaultWidgetConfig {
        return {
            id: "animator-settings",
            type: "floating-settings",
            minWidth: 360,
            minHeight: 180,
            defaultWidth: 452,
            defaultHeight: 460,
            title: "animator-settings",
            isCloseable: true,
            parentId: "animator",
            parentType: "animator",
            helpType: HelpType.ANIMATOR
        };
    }

    private activeIanaTimeZone: string | null = null;

    private get widgetStore(): AnimatorWidgetStore | undefined {
        return WidgetsStore.Instance.animatorWidgets.get(this.props.id);
    }

    state: AnimatorSettingsPanelState = {
        relativeReferenceIsoDraft: null,
        relativeReferenceIsoInvalid: false
    };

    componentDidMount() {
        this.setDefaultCustomIanaTimeZone();
    }

    private setDefaultCustomIanaTimeZone = () => {
        const widgetStore = this.widgetStore;
        if (widgetStore?.timeZoneMode === TimeZoneMode.IANA && widgetStore.ianaTimeZone === "UTC") {
            widgetStore.setIanaTimeZone(DEFAULT_CUSTOM_IANA_TIME_ZONE);
        }
    };

    private handleActiveIanaTimeZoneChange = (timeZone: string | null) => {
        this.activeIanaTimeZone = timeZone;
    };

    private handleIanaTimeZoneKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Tab" && this.activeIanaTimeZone) {
            this.widgetStore?.setIanaTimeZone(this.activeIanaTimeZone);
        }
    };

    private handleTimeZoneModeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        this.widgetStore?.setTimeZoneMode(event.currentTarget.value as TimeZoneMode);
        this.setDefaultCustomIanaTimeZone();
    };

    private resetRelativeReferenceIso = () => {
        this.setState({relativeReferenceIsoDraft: null, relativeReferenceIsoInvalid: false});
    };

    private commitRelativeReferenceIso = () => {
        const draft = this.state.relativeReferenceIsoDraft;
        if (draft === null) {
            return;
        }

        const widgetStore = this.widgetStore;
        if (!widgetStore) {
            return;
        }

        const mjdUtc = parseIsoInScaleToMjdUtc(draft, widgetStore.timeScale);
        if (isFinite(mjdUtc)) {
            widgetStore.setRelativeReferenceMjdUtc(mjdUtc);
            this.resetRelativeReferenceIso();
        } else {
            this.setState({relativeReferenceIsoInvalid: true});
        }
    };

    private handleRelativeReferenceIsoKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter") {
            event.preventDefault();
            this.commitRelativeReferenceIso();
        } else if (event.key === "Escape") {
            event.preventDefault();
            this.resetRelativeReferenceIso();
        }
    };

    private handleRelativeReferenceChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        this.resetRelativeReferenceIso();

        const widgetStore = this.widgetStore;
        if (!widgetStore) {
            return;
        }

        const elements = AppStore.Instance.timeSeriesStore.elements;
        const firstElement = elements[0];
        const reference = event.currentTarget.value as RelativeTimeReference;
        widgetStore.setRelativeTimeReference(reference);
        const shouldSetImageReference = reference === RelativeTimeReference.IMAGE && !elements.some(element => element.mjdUtc === widgetStore.relativeReferenceMjdUtc);
        const shouldSetCustomReference = reference === RelativeTimeReference.CUSTOM && widgetStore.relativeReferenceMjdUtc === null;
        if (firstElement && (shouldSetImageReference || shouldSetCustomReference)) {
            widgetStore.setRelativeReferenceMjdUtc(firstElement.mjdUtc);
        }
    };

    private handleReferenceImageChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const element = AppStore.Instance.timeSeriesStore.elements[Number(event.currentTarget.value)];
        if (element) {
            this.widgetStore?.setRelativeReferenceMjdUtc(element.mjdUtc);
        }
    };

    private handleReferenceMjdChange = (value: number) => {
        this.resetRelativeReferenceIso();
        const widgetStore = this.widgetStore;
        if (!widgetStore) {
            return;
        }
        const mjdUtc = convertMjdToUtc(value, widgetStore.timeScale);
        if (isFinite(mjdUtc)) {
            widgetStore.setRelativeReferenceMjdUtc(mjdUtc);
        }
    };

    private handleTimeScaleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        this.resetRelativeReferenceIso();
        this.widgetStore?.setTimeScale(event.currentTarget.value as TimeScale);
    };

    private handleTimeSliderVisibilityChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const widgetStore = this.widgetStore;
        if (!widgetStore) {
            return;
        }

        const isVisible = event.currentTarget.checked;
        const animatorStore = AppStore.Instance.animatorStore;
        if (animatorStore.isAnimationActive) {
            return;
        }
        if (!isVisible && animatorStore.animationMode === AnimationMode.TIME) {
            animatorStore.selectFirstAvailableAnimationMode(AnimationMode.TIME);
        } else if (isVisible && animatorStore.animationMode === AnimationMode.NONE) {
            animatorStore.setAnimationMode(AnimationMode.TIME);
        }
        widgetStore.setTimeSliderVisible(isVisible);
    };

    private handleNumericPrecisionChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const value = event.currentTarget.value;
        this.widgetStore?.setNumericTimePrecision(value === "auto" ? null : Number(value));
    };

    render() {
        const widgetStore = this.widgetStore;
        if (!widgetStore) {
            return null;
        }

        const elements = AppStore.Instance.timeSeriesStore.elements;
        const isTimeSliderAvailable = elements.length > 1;
        const isTimeSliderToggleDisabled = !isTimeSliderAvailable || AppStore.Instance.animatorStore.isAnimationActive;
        const labelResult = getTimeSeriesTickLabelResult(elements, widgetStore);
        const selectedReferenceImageIndex = elements.findIndex(element => element.mjdUtc === widgetStore.relativeReferenceMjdUtc);
        const effectiveReferenceMjdUtc = widgetStore.relativeReferenceMjdUtc ?? elements[0]?.mjdUtc;
        const referenceIso = effectiveReferenceMjdUtc === undefined ? "" : formatMjdUtcAsIsoInScale(effectiveReferenceMjdUtc, widgetStore.timeScale, 6);
        const referenceMjd = effectiveReferenceMjdUtc === undefined ? undefined : convertMjdUtcToScale(effectiveReferenceMjdUtc, widgetStore.timeScale);
        const hasInvalidIanaTimeZone = widgetStore.timeLabelFormat === TimeLabelFormat.ISO && widgetStore.timeZoneMode === TimeZoneMode.IANA && !isValidIanaTimeZone(widgetStore.ianaTimeZone);
        const referenceImageOptions = elements.map((element, index) => {
            const scaledMjd = convertMjdUtcToScale(element.mjdUtc, widgetStore.timeScale);
            const scaledIso = formatMjdUtcAsIsoInScale(element.mjdUtc, widgetStore.timeScale, 6);
            return {value: index.toString(), label: `${element.frame.filename} — ${scaledIso} ${widgetStore.timeScale} — MJD ${scaledMjd.toFixed(6)} ${widgetStore.timeScale}`};
        });
        if (referenceImageOptions.length === 0) {
            referenceImageOptions.push({value: "", label: "No time-series images"});
        }

        const ianaTimeZoneInputProps = {
            placeholder: `e.g. ${DEFAULT_CUSTOM_IANA_TIME_ZONE}`,
            intent: hasInvalidIanaTimeZone ? Intent.DANGER : Intent.NONE,
            onKeyDown: this.handleIanaTimeZoneKeyDown,
            "data-testid": "animator-iana-time-zone"
        };
        const displaySectionTitleId = `${this.props.id}-display-section-title`;
        const timeFormatSectionTitleId = `${this.props.id}-time-format-section-title`;
        const timeScaleSectionTitleId = `${this.props.id}-time-scale-section-title`;
        const precisionSectionTitleId = `${this.props.id}-precision-section-title`;

        const content = (
            <div className="animator-time-settings">
                <section className="animator-settings-section" aria-labelledby={displaySectionTitleId} data-testid="animator-time-slider-display-section">
                    <H3 id={displaySectionTitleId} className="animator-settings-section-title">
                        Display
                    </H3>
                    <FormGroup inline={true} label="Show time slider" disabled={isTimeSliderToggleDisabled}>
                        <Switch
                            checked={isTimeSliderAvailable && widgetStore.isTimeSliderVisible}
                            disabled={isTimeSliderToggleDisabled}
                            onChange={this.handleTimeSliderVisibilityChange}
                            title={!isTimeSliderAvailable ? "Requires at least two time-series images" : AppStore.Instance.animatorStore.isAnimationActive ? "Stop playback before changing this setting" : undefined}
                            data-testid="animator-time-slider-toggle"
                        />
                    </FormGroup>
                </section>

                <section className="animator-settings-section" aria-labelledby={timeFormatSectionTitleId} data-testid="animator-time-format-section">
                    <H3 id={timeFormatSectionTitleId} className="animator-settings-section-title">
                        Time format
                    </H3>
                    <FormGroup inline={true} label="Format">
                        <HTMLSelect
                            options={TIME_LABEL_FORMAT_OPTIONS}
                            value={widgetStore.timeLabelFormat}
                            onChange={event => widgetStore.setTimeLabelFormat(event.currentTarget.value as TimeLabelFormat)}
                            data-testid="animator-time-label-format"
                        />
                    </FormGroup>
                </section>

                <section className="animator-settings-section" aria-labelledby={timeScaleSectionTitleId} data-testid="animator-time-scale-section">
                    <H3 id={timeScaleSectionTitleId} className="animator-settings-section-title">
                        Time scale
                    </H3>

                    {widgetStore.timeLabelFormat === TimeLabelFormat.AUTO && (
                        <FormGroup inline={true} label="Scale">
                            <InputGroup value="UTC" disabled={true} data-testid="animator-compact-time-scale" />
                        </FormGroup>
                    )}

                    {widgetStore.timeLabelFormat === TimeLabelFormat.ISO && (
                        <React.Fragment>
                            <FormGroup inline={true} label="Time zone">
                                <HTMLSelect options={TIME_ZONE_OPTIONS} value={widgetStore.timeZoneMode} onChange={this.handleTimeZoneModeChange} data-testid="animator-time-zone" />
                            </FormGroup>
                            {widgetStore.timeZoneMode === TimeZoneMode.LOCAL && (
                                <FormGroup inline={true} label="IANA zone">
                                    <InputGroup value={BROWSER_IANA_TIME_ZONE} disabled={true} title="Detected from the browser" data-testid="animator-browser-iana-time-zone" />
                                </FormGroup>
                            )}
                            {widgetStore.timeZoneMode === TimeZoneMode.IANA && (
                                <FormGroup inline={true} label="IANA zone">
                                    <Suggest
                                        items={IANA_TIME_ZONES}
                                        itemPredicate={FilterTimeZone}
                                        itemRenderer={RenderTimeZoneOption}
                                        inputValueRenderer={() => widgetStore.ianaTimeZone}
                                        query={widgetStore.ianaTimeZone}
                                        onQueryChange={widgetStore.setIanaTimeZone}
                                        onItemSelect={widgetStore.setIanaTimeZone}
                                        onActiveItemChange={this.handleActiveIanaTimeZoneChange}
                                        noResults={<MenuItem disabled={true} text="No matching time zones" />}
                                        inputProps={ianaTimeZoneInputProps}
                                        popoverProps={{popoverClassName: "iana-time-zone-select", minimal: true}}
                                    />
                                </FormGroup>
                            )}
                        </React.Fragment>
                    )}

                    {(widgetStore.timeLabelFormat === TimeLabelFormat.MJD || widgetStore.timeLabelFormat === TimeLabelFormat.JD || widgetStore.timeLabelFormat === TimeLabelFormat.RELATIVE) && (
                        <FormGroup inline={true} label="Scale">
                            <HTMLSelect options={TIME_SCALE_OPTIONS} value={widgetStore.timeScale} onChange={this.handleTimeScaleChange} data-testid="animator-time-scale" />
                        </FormGroup>
                    )}

                    {widgetStore.timeLabelFormat === TimeLabelFormat.RELATIVE && (
                        <React.Fragment>
                            <FormGroup inline={true} label="Reference">
                                <HTMLSelect options={RELATIVE_REFERENCE_OPTIONS} value={widgetStore.relativeTimeReference} onChange={this.handleRelativeReferenceChange} data-testid="animator-relative-reference" />
                            </FormGroup>
                            {widgetStore.relativeTimeReference === RelativeTimeReference.IMAGE && (
                                <FormGroup inline={true} label="Reference image">
                                    <HTMLSelect
                                        className="reference-image-select"
                                        options={referenceImageOptions}
                                        value={elements.length > 0 ? Math.max(selectedReferenceImageIndex, 0).toString() : ""}
                                        onChange={this.handleReferenceImageChange}
                                        disabled={elements.length === 0}
                                        data-testid="animator-relative-reference-image"
                                    />
                                </FormGroup>
                            )}
                            {widgetStore.relativeTimeReference === RelativeTimeReference.CUSTOM && (
                                <React.Fragment>
                                    <FormGroup
                                        inline={true}
                                        label="Reference ISO"
                                        labelInfo={`(${widgetStore.timeScale})`}
                                        intent={this.state.relativeReferenceIsoInvalid ? Intent.DANGER : Intent.NONE}
                                        helperText={this.state.relativeReferenceIsoInvalid ? `Enter a ${widgetStore.timeScale} date-time such as 2026-07-20T12:30:00.000000` : undefined}
                                    >
                                        <InputGroup
                                            value={this.state.relativeReferenceIsoDraft ?? referenceIso}
                                            placeholder="YYYY-MM-DDTHH:mm:ss.ssssss"
                                            intent={this.state.relativeReferenceIsoInvalid ? Intent.DANGER : Intent.NONE}
                                            onChange={event => this.setState({relativeReferenceIsoDraft: event.currentTarget.value, relativeReferenceIsoInvalid: false})}
                                            onBlur={this.commitRelativeReferenceIso}
                                            onKeyDown={this.handleRelativeReferenceIsoKeyDown}
                                            data-testid="animator-relative-reference-iso"
                                        />
                                    </FormGroup>
                                    <FormGroup inline={true} label="Reference MJD" labelInfo={`(${widgetStore.timeScale})`}>
                                        <SafeNumericInput
                                            fill={true}
                                            buttonPosition="none"
                                            value={referenceMjd}
                                            placeholder={`MJD in ${widgetStore.timeScale}`}
                                            onValueChange={this.handleReferenceMjdChange}
                                            data-testid="animator-relative-reference-mjd"
                                        />
                                    </FormGroup>
                                </React.Fragment>
                            )}
                            <FormGroup inline={true} label="Relative unit">
                                <HTMLSelect
                                    options={RELATIVE_UNIT_OPTIONS}
                                    value={widgetStore.relativeTimeUnit}
                                    onChange={event => widgetStore.setRelativeTimeUnit(event.currentTarget.value as RelativeTimeUnit)}
                                    data-testid="animator-relative-time-unit"
                                />
                            </FormGroup>
                        </React.Fragment>
                    )}

                    {hasInvalidIanaTimeZone && (
                        <div className="time-label-warning">
                            <Icon icon="warning-sign" intent={Intent.WARNING} />
                            <span>Invalid IANA time zone; labels fall back to UTC.</span>
                        </div>
                    )}
                </section>

                <section className="animator-settings-section" aria-labelledby={precisionSectionTitleId} data-testid="animator-precision-section">
                    <H3 id={precisionSectionTitleId} className="animator-settings-section-title">
                        Precision
                    </H3>

                    {widgetStore.timeLabelFormat === TimeLabelFormat.AUTO && (
                        <FormGroup inline={true} label="Precision">
                            <InputGroup value="Automatic" disabled={true} data-testid="animator-compact-precision" />
                        </FormGroup>
                    )}

                    {widgetStore.timeLabelFormat === TimeLabelFormat.ISO && (
                        <FormGroup inline={true} label="Precision">
                            <HTMLSelect
                                options={ISO_PRECISION_OPTIONS}
                                value={widgetStore.isoTimePrecision}
                                onChange={event => widgetStore.setIsoTimePrecision(event.currentTarget.value as IsoTimePrecision)}
                                data-testid="animator-iso-time-precision"
                            />
                        </FormGroup>
                    )}

                    {(widgetStore.timeLabelFormat === TimeLabelFormat.MJD || widgetStore.timeLabelFormat === TimeLabelFormat.JD || widgetStore.timeLabelFormat === TimeLabelFormat.RELATIVE) && (
                        <FormGroup inline={true} label="Decimal places">
                            <HTMLSelect options={NUMERIC_PRECISION_OPTIONS} value={widgetStore.numericTimePrecision?.toString() ?? "auto"} onChange={this.handleNumericPrecisionChange} data-testid="animator-numeric-time-precision" />
                        </FormGroup>
                    )}

                    {labelResult.hasCollisions && (
                        <div className="time-label-warning">
                            <Icon icon="warning-sign" intent={Intent.WARNING} />
                            <span>Some observations share a tick label. Increase the precision.</span>
                        </div>
                    )}
                </section>
            </div>
        );
        return (
            <ScrollShadow>
                <div className="animator-settings-panel">
                    <Tabs id="animatorSettingsTabs">
                        <Tab id="time" title="Time" panel={content} />
                    </Tabs>
                </div>
            </ScrollShadow>
        );
    }
}
