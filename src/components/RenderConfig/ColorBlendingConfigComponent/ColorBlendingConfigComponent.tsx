import {Button, ButtonGroup, FormGroup, H6, HTMLSelect, Menu, MenuItem, Text} from "@blueprintjs/core";
import {Popover2, Tooltip2} from "@blueprintjs/popover2";
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

    const newFrameOptions = unselectedFrames.map((f, i) => <MenuItem text={f.filename} onClick={() => colorBlendingStore.addSelectedFrame(f)} key={i} />);
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
                        <Tooltip2
                            content={
                                <span>
                                    Add a new layer with a spatially matched image
                                    <span>
                                        <br />
                                        <i>
                                            <small>Include images as options by matching them spatially with the Image List widget.</small>
                                        </i>
                                    </span>
                                </span>
                            }
                        >
                            <Button icon="add" rightIcon="caret-down" disabled={!newFrameOptions.length}>
                                Add layer
                            </Button>
                        </Tooltip2>
                    </Popover2>
                    {/* TODO: use icon "color-fill" when updated to bp5 */}
                    <Button icon="draw" rightIcon="caret-down" disabled>
                        Apply color set
                    </Button>
                </ButtonGroup>
            </div>
            <FormGroup className="name-text" label="Layer 1" inline={true}>
                <Tooltip2
                    content={
                        <span>
                            The spatial reference
                            <span>
                                <br />
                                <i>
                                    <small>Change the image by changing the spatial reference with the Image List widget.</small>
                                </i>
                            </span>
                        </span>
                    }
                >
                    <Text ellipsize={true}>{colorBlendingStore.baseFrame.filename}</Text>
                </Tooltip2>
            </FormGroup>
            {colorBlendingStore.selectedFrames.map((f, i) => (
                <FormGroup className="name-text" label={`Layer ${i + 2}`} inline={true} key={i}>
                    <Tooltip2
                        content={
                            <span>
                                A spatially matched image
                                <span>
                                    <br />
                                    <i>
                                        <small>Include images as options by matching them spatially with the Image List widget.</small>
                                    </i>
                                </span>
                            </span>
                        }
                    >
                        <HTMLSelect value={f.id} options={getSetFrameOptions(f)} onChange={ev => setSelectedFrame(i, parseInt(ev.target.value))} />
                    </Tooltip2>
                </FormGroup>
            ))}
        </div>
    );
});
