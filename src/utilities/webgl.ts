import {AlertStore} from "stores";
import {TemplateNodes} from "./templates";

export const GL = WebGLRenderingContext;

export function getShaderFromString(gl: WebGLRenderingContext, shaderScript: string, type: number) {
    if (!gl || !shaderScript || !(type === GL.VERTEX_SHADER || type === GL.FRAGMENT_SHADER)) {
        return null;
    }

    let shader = gl.createShader(type);
    gl.shaderSource(shader, shaderScript);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, GL.COMPILE_STATUS)) {
        console.log(gl.getShaderInfoLog(shader));
        return null;
    }
    return shader;
}

export function getShaderProgram(gl: WebGLRenderingContext, vertexShaderString: string, pixelShaderString: string) {
    if (!gl) {
        return null;
    }

    let vertexShader = getShaderFromString(gl, vertexShaderString, GL.VERTEX_SHADER);
    let fragmentShader = getShaderFromString(gl, pixelShaderString, GL.FRAGMENT_SHADER);

    let shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);

    if (!gl.getProgramParameter(shaderProgram, GL.LINK_STATUS)) {
        console.log("Could not initialise shaders");
        return null;
    }
    return shaderProgram;
}
export function loadImageTexture(gl: WebGLRenderingContext, url: string, texIndex: number): Promise<WebGLTexture> {
    return new Promise<WebGLTexture>((resolve, reject) => {
        if (!gl) {
            reject();
        }
        const image = new Image();
        // Replace the existing texture with the real one once loaded
        image.onload = () => {
            const imageTexture = gl.createTexture();
            gl.activeTexture(texIndex);
            gl.bindTexture(GL.TEXTURE_2D, imageTexture);
            gl.texImage2D(GL.TEXTURE_2D, 0, GL.RGB, GL.RGB, GL.UNSIGNED_BYTE, image);
            gl.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_S, GL.CLAMP_TO_EDGE);
            gl.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_T, GL.CLAMP_TO_EDGE);
            gl.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MIN_FILTER, GL.NEAREST);
            gl.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MAG_FILTER, GL.NEAREST);
            resolve(imageTexture);
        };
        image.onerror = () => reject(`Error loading image ${url}`);
        image.src = url;
    });
}

export function createFP32Texture(gl: WebGLRenderingContext, width: number, height: number, texIndex: number, filtering: number = GL.NEAREST) {
    if (!gl) {
        return null;
    }
    const texture = gl.createTexture();
    gl.activeTexture(texIndex);
    gl.bindTexture(GL.TEXTURE_2D, texture);
    gl.texImage2D(GL.TEXTURE_2D, 0, GL.LUMINANCE, width, height, 0, GL.LUMINANCE, GL.FLOAT, new Float32Array(width * height));
    gl.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MIN_FILTER, filtering);
    gl.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MAG_FILTER, filtering);
    gl.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_S, GL.CLAMP_TO_EDGE);
    gl.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_T, GL.CLAMP_TO_EDGE);
    return texture;
}

export function copyToFP32Texture(gl: WebGLRenderingContext, texture: WebGLTexture, data: Float32Array, texIndex: number, dataWidth: number, dataHeight: number, xOffset: number, yOffset: number) {
    if (!gl) {
        return;
    }
    gl.bindTexture(GL.TEXTURE_2D, texture);
    gl.activeTexture(texIndex);
    gl.texSubImage2D(GL.TEXTURE_2D, 0, xOffset, yOffset, dataWidth, dataHeight, GL.LUMINANCE, GL.FLOAT, data);
    gl.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MIN_FILTER, GL.NEAREST);
    gl.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MAG_FILTER, GL.NEAREST);
    gl.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_S, GL.CLAMP_TO_EDGE);
    gl.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_T, GL.CLAMP_TO_EDGE);
}

export function initWebGL(){
    const gl = document.createElement("canvas").getContext("webgl");
    const floatExtension = gl?.getExtension("OES_texture_float");
    if (!gl || !floatExtension) {
        AlertStore.Instance.showAlert(TemplateNodes.WebGLErrorMessage, "issue");
        return null;
    }
    return gl;
}

export function initWebGL2(){
    const gl = document.createElement("canvas").getContext("webgl2");
    if (!gl) {
        AlertStore.Instance.showAlert(TemplateNodes.WebGL2ErrorMessage, "issue");
        return null;
    }
    return gl;
}

export function createTextureFromArray(gl: WebGL2RenderingContext, data: Float32Array, texIndex: number = WebGL2RenderingContext.TEXTURE0, components: number = 1):WebGLTexture {
    const GL2 = WebGL2RenderingContext;
    const numPoints = data.length / components;
    if (data.length % components !== 0) {
        console.error(`Invalid data size (${data.length} for number of components ${components}`);
        return null;
    }

    // Attempt to make a square texture by default
    let width = Math.ceil(Math.sqrt(numPoints));
    let height = Math.ceil(numPoints / width);

    let paddedData: Float32Array;
    if (width * height === numPoints) {
        paddedData = data;
    } else {
        paddedData = new Float32Array(width * height * components);
        paddedData.set(data, 0);
    }

    const texture = gl.createTexture();
    gl.activeTexture(texIndex);
    gl.bindTexture(GL2.TEXTURE_2D, texture);
    switch (components) {
        case 1:
            gl.texImage2D(GL2.TEXTURE_2D, 0, GL2.R32F, width, height, 0, GL2.RED, GL2.FLOAT, paddedData);
            break;
        case 2:
            gl.texImage2D(GL2.TEXTURE_2D, 0, GL2.RG32F, width, height, 0, GL2.RG, GL2.FLOAT, paddedData);
            break;
        case 3:
            gl.texImage2D(GL2.TEXTURE_2D, 0, GL2.RGB32F, width, height, 0, GL2.RGB, GL2.FLOAT, paddedData);
            break;
        case 4:
            gl.texImage2D(GL2.TEXTURE_2D, 0, GL2.RGBA32F, width, height, 0, GL2.RGBA, GL2.FLOAT, paddedData);
            break;
        default:
            console.error(`Invalid number of components specified: ${components}`);
            return null;
    }
    gl.texParameteri(GL2.TEXTURE_2D, GL2.TEXTURE_MIN_FILTER, GL2.NEAREST);
    gl.texParameteri(GL2.TEXTURE_2D, GL2.TEXTURE_MAG_FILTER, GL2.NEAREST);
    gl.texParameteri(GL2.TEXTURE_2D, GL2.TEXTURE_WRAP_S, GL2.CLAMP_TO_EDGE);
    gl.texParameteri(GL2.TEXTURE_2D, GL2.TEXTURE_WRAP_T, GL2.CLAMP_TO_EDGE);
    return texture;
}