import {useState} from "react";
import {AnchorButton, FormGroup, HTMLSelect, InputGroup, Intent, Overlay2, Radio, RadioGroup, Spinner, Tooltip} from "@blueprintjs/core";
import {observer} from "mobx-react";

import {SafeNumericInput} from "components/Shared";
import {AppStore, HipsCoord, HipsProjection, HipsQueryStore} from "stores";

import "./HipsQueryComponent.scss";

export const HipsQueryComponent = observer(() => {
    const hipsQueryStore = HipsQueryStore.Instance;

    const [queryByObject, setQueryByObject] = useState<boolean>(true);

    return (
        <div className="hips-query-panel">
            <div className="hips-query-config">
                <FormGroup inline={true} label="HiPS survey" disabled={hipsQueryStore.isLoading}>
                    <InputGroup defaultValue={hipsQueryStore.hipsSurvey} onChange={ev => hipsQueryStore.setHipsSurvey(ev.target.value)} disabled={hipsQueryStore.isLoading} />
                </FormGroup>
                <FormGroup inline={true} label="Dimension" labelInfo="(px)" disabled={hipsQueryStore.isLoading}>
                    <SafeNumericInput
                        placeholder="Width"
                        min={1}
                        majorStepSize={100}
                        stepSize={100}
                        value={Number.isNaN(hipsQueryStore.size.x) ? "" : hipsQueryStore.size.x}
                        onValueChange={hipsQueryStore.setWidth}
                        disabled={hipsQueryStore.isLoading}
                    />
                    <SafeNumericInput
                        placeholder="Height"
                        min={1}
                        majorStepSize={100}
                        stepSize={100}
                        value={Number.isNaN(hipsQueryStore.size.y) ? "" : hipsQueryStore.size.y}
                        onValueChange={hipsQueryStore.setHeight}
                        disabled={hipsQueryStore.isLoading}
                    />
                </FormGroup>
                <FormGroup inline={true} label=" " disabled={hipsQueryStore.isLoading}>
                    <RadioGroup inline={true} selectedValue={queryByObject ? "object" : "center"} onChange={ev => setQueryByObject(ev.currentTarget.value === "object")} disabled={hipsQueryStore.isLoading}>
                        <Radio label="Query by object" value="object" />
                        <Radio label="Query by center" value="center" />
                    </RadioGroup>
                </FormGroup>
                {queryByObject && (
                    <FormGroup inline={true} label="Object" disabled={hipsQueryStore.isLoading}>
                        <InputGroup defaultValue={hipsQueryStore.object} onChange={ev => hipsQueryStore.setObject(ev.target.value)} disabled={hipsQueryStore.isLoading} />
                    </FormGroup>
                )}
                {!queryByObject && (
                    <FormGroup inline={true} label="Center" labelInfo="(deg)" disabled={hipsQueryStore.isLoading}>
                        <SafeNumericInput
                            buttonPosition="none"
                            placeholder="X WCS coordinate"
                            value={Number.isNaN(hipsQueryStore.center.x) ? "" : hipsQueryStore.center.x}
                            onValueChange={hipsQueryStore.setCenterX}
                            disabled={hipsQueryStore.isLoading}
                        />
                        <SafeNumericInput
                            buttonPosition="none"
                            placeholder="Y WCS coordinate"
                            value={Number.isNaN(hipsQueryStore.center.y) ? "" : hipsQueryStore.center.y}
                            onValueChange={hipsQueryStore.setCenterY}
                            disabled={hipsQueryStore.isLoading}
                        />
                    </FormGroup>
                )}
                <FormGroup inline={true} label="Field of view" labelInfo="(deg)" disabled={hipsQueryStore.isLoading}>
                    <SafeNumericInput buttonPosition="none" value={Number.isNaN(hipsQueryStore.fov) ? "" : hipsQueryStore.fov} onValueChange={hipsQueryStore.setFov} disabled={hipsQueryStore.isLoading} />
                    <Tooltip content="Set to current view center">
                        <AnchorButton icon="locate" disabled={hipsQueryStore.isLoading || !AppStore.Instance.activeFrame} onClick={() => {}} />
                    </Tooltip>
                </FormGroup>
                <FormGroup inline={true} label="Coordinate system" disabled={hipsQueryStore.isLoading}>
                    <RadioGroup inline={true} onChange={ev => hipsQueryStore.setCoordsys(ev.currentTarget.value as HipsCoord)} selectedValue={hipsQueryStore.coordsys} disabled={hipsQueryStore.isLoading}>
                        <Radio label="ICRS" value={HipsCoord.Icrs} />
                        <Radio label="Galatic" value={HipsCoord.Galactic} />
                    </RadioGroup>
                </FormGroup>
                <FormGroup inline={true} label="Projection" disabled={hipsQueryStore.isLoading}>
                    <HTMLSelect
                        options={Object.values(HipsProjection).map(val => ({label: `${val} - ${HipsQueryStore.ProjectionOptionMap.get(val)}`, value: val}))}
                        value={hipsQueryStore.projection}
                        onChange={ev => hipsQueryStore.setProjection(ev.currentTarget.value as HipsProjection)}
                        disabled={hipsQueryStore.isLoading}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Rotation angle" labelInfo="(deg)" disabled={hipsQueryStore.isLoading}>
                    <SafeNumericInput buttonPosition="none" value={hipsQueryStore.rotationAngle} onValueChange={hipsQueryStore.setRotationAngle} disabled={hipsQueryStore.isLoading} />
                </FormGroup>
            </div>
            <Overlay2 autoFocus={true} canEscapeKeyClose={false} canOutsideClickClose={false} isOpen={hipsQueryStore.isLoading} usePortal={false}>
                <div className="query-loading-overlay">
                    <Spinner intent={Intent.PRIMARY} size={30} value={null} />
                </div>
            </Overlay2>
            <div className="query-footer">
                <AnchorButton
                    intent={Intent.SUCCESS}
                    disabled={(queryByObject ? !hipsQueryStore.object : !isFinite(hipsQueryStore.center.x) || !isFinite(hipsQueryStore.center.y)) || !hipsQueryStore.isValid}
                    onClick={queryByObject ? hipsQueryStore.queryByObject : hipsQueryStore.queryByCenter}
                    text="Query"
                />
            </div>
        </div>
    );
});
