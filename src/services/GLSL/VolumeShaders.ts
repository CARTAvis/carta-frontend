import pixelShader from "./pixel_shader_volume.glsl";
import vertexShader from "./vertex_shader_volume.glsl";

export const volumeShaders = {
    vertexShader: `${vertexShader}`,
    fragmentShader: `${pixelShader}`
};