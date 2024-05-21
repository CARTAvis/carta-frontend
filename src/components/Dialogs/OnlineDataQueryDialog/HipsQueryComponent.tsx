import {useState} from "react";
import {AnchorButton, FormGroup, HTMLSelect, InputGroup, Intent, Radio, RadioGroup, Tooltip} from "@blueprintjs/core";
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
                <FormGroup inline={true} label="HiPS survey">
                    <InputGroup defaultValue={hipsQueryStore.hipsSurvey} onChange={ev => hipsQueryStore.setHipsSurvey(ev.target.value)} />
                </FormGroup>
                <FormGroup inline={true} label="Dimension" labelInfo="(px)">
                    <SafeNumericInput placeholder="Width" min={1} majorStepSize={100} stepSize={100} value={Number.isNaN(hipsQueryStore.size.x) ? "" : hipsQueryStore.size.x} onValueChange={hipsQueryStore.setWidth} />
                    <SafeNumericInput placeholder="Height" min={1} majorStepSize={100} stepSize={100} value={Number.isNaN(hipsQueryStore.size.y) ? "" : hipsQueryStore.size.y} onValueChange={hipsQueryStore.setHeight} />
                </FormGroup>
                <FormGroup inline={true} label=" ">
                    <RadioGroup inline={true} selectedValue={queryByObject ? "object" : "center"} onChange={ev => setQueryByObject(ev.currentTarget.value === "object")}>
                        <Radio label="Query by object" value="object" />
                        <Radio label="Query by center" value="center" />
                    </RadioGroup>
                </FormGroup>
                {queryByObject && (
                    <FormGroup inline={true} label="Object">
                        <InputGroup defaultValue={hipsQueryStore.object} onChange={ev => hipsQueryStore.setObject(ev.target.value)} />
                    </FormGroup>
                )}
                {!queryByObject && (
                    <FormGroup inline={true} label="Center" labelInfo="(deg)">
                        <SafeNumericInput buttonPosition="none" placeholder="X WCS coordinate" value={Number.isNaN(hipsQueryStore.center.x) ? "" : hipsQueryStore.center.x} onValueChange={hipsQueryStore.setCenterX} />
                        <SafeNumericInput buttonPosition="none" placeholder="Y WCS coordinate" value={Number.isNaN(hipsQueryStore.center.y) ? "" : hipsQueryStore.center.y} onValueChange={hipsQueryStore.setCenterY} />
                    </FormGroup>
                )}
                <FormGroup inline={true} label="Field of view" labelInfo="(deg)">
                    <SafeNumericInput buttonPosition="none" value={Number.isNaN(hipsQueryStore.fov) ? "" : hipsQueryStore.fov} onValueChange={hipsQueryStore.setFov} />
                    <Tooltip content="Set to current view center">
                        <AnchorButton icon="locate" disabled={!AppStore.Instance.activeFrame} onClick={() => {}} />
                    </Tooltip>
                </FormGroup>
                <FormGroup inline={true} label="Coordinate system">
                    <RadioGroup inline={true} onChange={ev => hipsQueryStore.setCoordsys(ev.currentTarget.value as HipsCoord)} selectedValue={hipsQueryStore.coordsys}>
                        <Radio label="ICRS" value={HipsCoord.Icrs} />
                        <Radio label="Galatic" value={HipsCoord.Galactic} />
                    </RadioGroup>
                </FormGroup>
                <FormGroup inline={true} label="Projection">
                    <HTMLSelect
                        options={Object.values(HipsProjection).map(val => ({label: `${val} - ${HipsQueryStore.ProjectionOptionMap.get(val)}`, value: val}))}
                        value={hipsQueryStore.projection}
                        onChange={ev => hipsQueryStore.setProjection(ev.currentTarget.value as HipsProjection)}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Rotation angle" labelInfo="(deg)">
                    <SafeNumericInput buttonPosition="none" value={hipsQueryStore.rotationAngle} onValueChange={hipsQueryStore.setRotationAngle} />
                </FormGroup>
            </div>
            <div className="query-footer">
                <AnchorButton intent={Intent.SUCCESS} onClick={queryByObject ? hipsQueryStore.queryByObject : hipsQueryStore.queryByCenter} text="Query" />
            </div>
        </div>
    );
});
