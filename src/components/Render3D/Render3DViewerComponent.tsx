import React, { useRef, useState } from "react";
import { Canvas, useFrame } from '@react-three/fiber'
import {action, observable} from "mobx";
import {observer} from "mobx-react";
import * as THREE from 'three'

import { ResizeDetector } from "components/Shared";
// import { ResizeDetector } from "components/Shared";
// import {ImagePanelComponent} from "components/ImageView/ImagePanel/ImagePanelComponent";
// import {ResizeDetector} from "components/Shared/ResizeDetector/ResizeDetector";
// import {ImageType} from "models";
import {DefaultWidgetConfig} from "stores"; // , WidgetsStore


interface Render3DViewerDialogProps {
    id: string;
    docked: boolean;
    floatingSettingsId?: string;
}

// function App() {
//     return (
//       <div id="canvas-container">
//         <Canvas>
//       <mesh>
//         <boxGeometry args={[2, 2, 2]} />
//         <meshPhongMaterial />
//       </mesh>
//       <ambientLight intensity={0.1} />
//       <directionalLight position={[0, 0, 5]} color="red" />
//     </Canvas>
//       </div>
//     )
//   }
  
//   createRoot(document.getElementById('root')).render(<App />)

function Box(props: JSX.IntrinsicElements['mesh']) {
  // This reference will give us direct access to the THREE.Mesh object
  const ref = useRef<THREE.Mesh>(null!)
  // Hold state for hovered and clicked events
  const [hovered, hover] = useState(false)
  const [clicked, click] = useState(false)
  console.log(hovered)
  // Rotate mesh every frame, this is outside of React without overhead
  useFrame((state, delta) => (ref.current.rotation.x += 0.01))

  return (
    <mesh
      {...props}
      ref={ref}
      scale={clicked ? 1.5 : 1}
      onClick={(event) => click(!clicked)}
      onPointerOver={(event) => hover(true)}
      onPointerOut={(event) => hover(false)}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial/>
      {/* color={hovered ? 'hotpink' : 'orange'} */}
    </mesh>
  )
}

export function App() {
  return (
    <Canvas>
      <ambientLight intensity={0.5} />
      <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} />
      <pointLight position={[-10, -10, -10]} />
      <Box position={[-1.2, 0, 0]} />
      <Box position={[1.2, 0, 0]} />
    </Canvas>
  )
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
            parentId: "render-3d",
            parentType: "render-3d"
        };
    }
    
    @observable width: number;
    @observable height: number;
    @action onResize = (width: number, height: number) => {
        this.width = width;
        this.height = height;
    };

    render() {
        // const frame = WidgetsStore?.Instance.render3DWidgets?.get(this.props.id)?.render3DFrame;

        return (
          <div className="render-3d-viewer-widget">
            it works
            <ResizeDetector onResize={this.onResize} throttleTime={33}>
                <div className="render-3d-canvas">
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
          </div>
        );
    }
}
