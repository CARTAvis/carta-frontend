import pixelShader from "./pixel_shader_volume.glsl";
import vertexShader from "./vertex_shader_volume.glsl";


// #version 300 es\n when using VolumeWebGLService
export const volumeShaders = {
    vertexShader: `${vertexShader}`,
    fragmentShader: `${pixelShader}`
};