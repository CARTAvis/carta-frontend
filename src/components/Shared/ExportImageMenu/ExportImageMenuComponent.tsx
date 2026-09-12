import * as React from "react";
import {Button, ButtonGroup, H6, Radio, RadioGroup} from "@blueprintjs/core";
import {observer} from "mobx-react";

import {VectorGraphicFormat} from "enums";
import {AppStore} from "stores";

export const ExportImageMenuComponent = observer(() => {
    const [imageRatio, setImageRatio] = React.useState(1);
    const appStore = AppStore.Instance;
    const vectorGraphicFormat = appStore.preferenceStore.vectorGraphicFormat;

    return (
        <React.Fragment>
            <H6 style={{padding: "2px 0 0 2px"}}> Resolution </H6>
            <RadioGroup selectedValue={String(imageRatio)} onChange={event => setImageRatio(Number(event.currentTarget.value))} style={{paddingLeft: "4px"}}>
                <Radio label="100%" value="1" />
                <Radio label="200%" value="2" />
                <Radio label="400%" value="4" />
            </RadioGroup>
            <ButtonGroup fill={true} vertical={true}>
                <Button text="PNG" onClick={() => appStore.exportImage(imageRatio)} />
                {vectorGraphicFormat === VectorGraphicFormat.SVG ? <Button text="SVG" onClick={() => appStore.exportSvgImage(imageRatio)} /> : <Button text="PDF" onClick={() => appStore.exportPdfImage(imageRatio)} />}
            </ButtonGroup>
        </React.Fragment>
    );
});
