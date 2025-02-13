import React from "react";
import { Canvas } from "@react-three/fiber";
import {action, observable} from "mobx";
import {observer} from "mobx-react";

// import {ImagePanelComponent} from "components/ImageView/ImagePanel/ImagePanelComponent";
import {ResizeDetector} from "components/Shared/ResizeDetector/ResizeDetector";
// import {ImageType} from "models";
import {DefaultWidgetConfig} from "stores"; // , WidgetsStore


interface Render3DViewerDialogProps {
    id: string;
    docked: boolean;
    floatingSettingsId?: string;
}

@observer
export class Render3DViewerComponent extends React.Component<Render3DViewerDialogProps> {
    public static get WIDGET_CONFIG(): DefaultWidgetConfig {
        return {
            id: "render-3d-viewer",
            type: "render-3d-viewer",
            minWidth: 300,
            minHeight: 300,
            defaultWidth: 600,
            defaultHeight: 600,
            title: "3D Rendering Viewer",
            isCloseable: true,
            parentId: "render3d",
            parentType: "render3d"
        };
    }
    
    @observable width: number;
    @observable height: number;
    @action onResize = (width: number, height: number) => {
        this.width = width;
        this.height = height;
    };

    public render() {
        // const frame = WidgetsStore?.Instance.render3DWidgets?.get(this.props.id)?.render3DFrame;

        return (
            <ResizeDetector onResize={this.onResize} throttleTime={33}>
                <div className="render-3d-viewer-widget">
                    <Canvas style={{ width: "100%", height: "100%" }}>
                        <mesh>
                            <boxGeometry args={[2, 2, 2]} />
                            <meshPhongMaterial />
                        </mesh>
                        <ambientLight intensity={0.1} />
                        <directionalLight position={[0, 0, 5]} color="red" />
                    </Canvas>
                </div>
            </ResizeDetector>
        );
    }
}
