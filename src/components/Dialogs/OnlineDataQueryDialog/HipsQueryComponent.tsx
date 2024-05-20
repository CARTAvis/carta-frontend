import {useState} from "react";
import {AnchorButton, FormGroup, HTMLSelect, InputGroup, Intent, Radio, RadioGroup} from "@blueprintjs/core";
import {Tooltip2} from "@blueprintjs/popover2";
import {observer} from "mobx-react";

import {InputType, SafeNumericInput, WcsCoordNumericInput} from "components/Shared";
import {SystemType} from "stores";

import "./HipsQueryComponent.scss";

export const HipsQueryComponent = observer(() => {
    const [queryByObject, setQueryByObject] = useState<boolean>(true);

    return (
        <div className="hips-query-panel">
            <div className="hips-query-config">
                <FormGroup inline={true} label="HiPS survey">
                    <InputGroup />
                </FormGroup>
                <FormGroup inline={true} label="Dimension" labelInfo="(px)">
                    <SafeNumericInput placeholder="Width" buttonPosition="none" />
                    <SafeNumericInput placeholder="Height" buttonPosition="none" />
                </FormGroup>
                <FormGroup inline={true} label=" ">
                    <RadioGroup inline={true} selectedValue={queryByObject ? "object" : "center"} onChange={ev => setQueryByObject(ev.currentTarget.value === "object")}>
                        <Radio label="Query by object" value="object" />
                        <Radio label="Query by center" value="center" />
                    </RadioGroup>
                </FormGroup>
                {queryByObject && (
                    <FormGroup inline={true} label="Object">
                        <InputGroup />
                    </FormGroup>
                )}
                {!queryByObject && (
                    <FormGroup inline={true} label="Center coordinates" className="center-input-form">
                        <HTMLSelect options={Object.keys(SystemType).map(key => ({label: key, value: SystemType[key]}))} />
                        <WcsCoordNumericInput inputType={InputType.XCoord} valueWcs={null} onChangeWcs={null} />
                        <WcsCoordNumericInput inputType={InputType.YCoord} valueWcs={null} onChangeWcs={null} />
                        <Tooltip2 content="Reset to current view center">
                            <AnchorButton icon="locate" onClick={() => {}} />
                        </Tooltip2>
                    </FormGroup>
                )}
                <FormGroup inline={true} label="Field of view" labelInfo="(deg)">
                    <SafeNumericInput buttonPosition="none" />
                    <AnchorButton text="Set to viewer" />
                </FormGroup>
                <FormGroup inline={true} label="Coordinate system">
                    <RadioGroup inline={true} onChange={() => {}} selectedValue="icrs">
                        <Radio label="ICRS" value="icrs" />
                        <Radio label="Galatic" value="galatic" />
                    </RadioGroup>
                </FormGroup>
                <FormGroup inline={true} label="Projection">
                    <HTMLSelect>
                        <option key={0} value={"tan"}>
                            TAN - tangential
                        </option>
                    </HTMLSelect>
                </FormGroup>
                <FormGroup inline={true} label="Rotation angle" labelInfo="(deg)">
                    <SafeNumericInput value={0} buttonPosition="none" />
                </FormGroup>
            </div>
            <div className="query-footer">
                <AnchorButton intent={Intent.SUCCESS} onClick={() => {}} text="Query" />
            </div>
        </div>
    );
});
