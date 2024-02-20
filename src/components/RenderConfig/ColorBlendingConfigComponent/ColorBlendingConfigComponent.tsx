import {Button, ButtonGroup, FormGroup, H6, HTMLSelect, Menu, MenuItem, Text} from "@blueprintjs/core";
import {Popover2} from "@blueprintjs/popover2";
import {observer} from "mobx-react";

import {ImageType} from "models";
import {AppStore, type FrameStore} from "stores";

import "./ColorBlendingConfigComponent.scss";

export const ColorBlendingConfigComponent = observer(() => {
    const image = AppStore.Instance.activeImage;
    if (image?.type !== ImageType.COLOR_BLENDING) {
        return null;
    }
    const colorBlendingStore = image.store;
    const matchedFrames = colorBlendingStore.baseFrame?.secondarySpatialImages ?? [];
    const unselectedFrames = matchedFrames.filter(f => !colorBlendingStore.selectedFrames.includes(f));

    const newFrameOptions = unselectedFrames.map(f => <MenuItem text={f.filename} onClick={() => colorBlendingStore.addSelectedFrame(f)} />);
    const getSetFrameOptions = (frame: FrameStore): {value: number; label: string}[] => {
        return matchedFrames.filter(f => unselectedFrames.includes(f) || f === frame).map(f => ({value: f.id, label: f.filename}));
    };

    const setSelectedFrame = (index: number, fileId: number) => {
        colorBlendingStore.setSelectedFrame(index, AppStore.Instance.getFrame(fileId));
    };

    return (
        <div className="color-blending-config">
            <div className="heading">
                <H6>Color blending configuration</H6>
                <ButtonGroup>
                    <Popover2 minimal={true} content={<Menu>{newFrameOptions}</Menu>}>
                        <Button icon="add" rightIcon="caret-down" disabled={!newFrameOptions.length}>
                            Add layer
                        </Button>
                    </Popover2>
                    {/* TODO: use icon "color-fill" when updated to bp5 */}
                    <Button icon="draw" rightIcon="caret-down" disabled>
                        Apply color set
                    </Button>
                </ButtonGroup>
            </div>
            <FormGroup className="name-text" label="Layer 1" inline={true}>
                <Text ellipsize={true}>{colorBlendingStore.baseFrame.filename}</Text>
            </FormGroup>
            {colorBlendingStore.selectedFrames.map((f, i) => (
                <FormGroup className="name-text" label={`Layer ${i + 2}`} inline={true} key={i}>
                    <HTMLSelect value={f.id} options={getSetFrameOptions(f)} onChange={ev => setSelectedFrame(i, parseInt(ev.target.value))} />
                </FormGroup>
            ))}
        </div>
    );
});
