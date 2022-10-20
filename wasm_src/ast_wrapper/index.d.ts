export interface AstObject{}
export interface FrameSet extends AstObject {}
export interface Frame extends AstObject {}
export interface Mapping extends AstObject {}
export interface FitsChan extends AstObject {}
export interface SpecFrame extends AstObject {}

export let fonts: string[];
export function setColors(newColors: string[]): void;
export function setColor(color: string, index: number): void;
export function setFontList(newList: string[]): void;
export function setCanvas(canvas: HTMLCanvasElement);

// cwrap'd functions
export function plot(frameSet: FrameSet, imageX1: number, imageX2: number, imageY1: number, imageY2: number, width: number, height: number, paddingLeft: number, paddingRight: number, paddingTop: number, paddingBottom: number, options: string, showCurve: boolean, isPVImage: boolean, curveX1: number, curveY1: number, curveX2: number, curveY2: number);
export function emptyFitsChan(): FitsChan;
export function putFits(fitsChan: FitsChan, card: string): void;
export function getFrameFromFitsChan(fitsChan: FitsChan, checkSkyDomain: boolean): FrameSet;
export function getSpectralFrame(frameSet: FrameSet): SpecFrame;
export function getSkyFrameSet(frameSet: FrameSet): FrameSet;
export function initDummyFrame(): FrameSet;
export function set(obj: AstObject, settings: string): number;
export function clear(obj: AstObject, attrib: string): number;
export function getString(obj: AstObject, attrib: string): string;
export function dump(obj: AstObject): void;
// Not exported norm()
export function axDistance(frameSet: FrameSet, axis: number, v1: number, v2: number);
export function geodesicDistance(frameSet: FrameSet, x1: number, y1: number, x2: number, y2: number): number;
export function format(frameSet: FrameSet, axis: number, value: number): string;
// Not exported unformat()
// Not exported transform(), transform3D(), spectralTransform()
export function getLastErrorMessage(): string;
export function clearLastErrorMessage(): void;
export function copy<T extends AstObject>(src: T): T;
export function deleteObject(src: AstObject): void;
export function invert(src: FrameSet): FrameSet;
export function convert(from: FrameSet | Frame, to: Frame | FrameSet, domainList: string): FrameSet;
export function shiftMap2D(x: number, y: number): Mapping;
export function scaleMap2D(x: number, y: number): Mapping;
export function frame(numAxes: number, options: string): Frame;
export function addFrame(frameSet: FrameSet, index: number, map: Mapping, frame: Frame);
export function setI(obj: AstObject, attrib: string, value: number): void;
export function setD(obj: AstObject, attrib: string, value: number): void;
export function createTransformedFrameset(frameSet: FrameSet, offsetX: number, offsetY: number, angle: number, originX: number, originY: number, scaleX: number, scaleY: number);
// Not exported fillTransformGrid()

// Helper functions
export function getFormattedCoordinates(frameSet: FrameSet, x: number, y: number, formatString?: string, tempFormat?: boolean): {x: string, y: string};
export function getWCSValueFromFormattedString(frameSet: FrameSet, formatString: {x: string, y: string}): {x: number, y: number};
export function transformPointArrays(frameSet: FrameSet, xIn: Float64Array, yIn: Float64Array, forward?: boolean): {x: Float64Array, y: Float64Array};
export function transformPoint(frameSet: FrameSet, x: number, y: number, forward?: boolean): {x: number, y: number};
export function transformPointList(frameSet: FrameSet, x: Float64Array, y: Float64Array);
export function transformAxPointList(frameSet: FrameSet, axis: number, x: number, y: number);
export function transform3DPoint(frameSet: FrameSet, x: number, y: number, z: number, forward?: boolean): {x: number, y: number, z: number};
export function transformSpectralPoint(specFrame: SpecFrame, specType: string, specUnit: string, specSys: string, z: number, forward?: boolean);
export function transformSpectralPointArray(specFrame: SpecFrame, specType: string, specUnit: string, specSys: string, zIn: Float64Array | Array<number>, forward?: boolean): Float64Array;
export function normalizeCoordinates(frameSet: FrameSet, x: number, y: number): {x: number, y: number};
export function getTransformGrid(transformFrameSet: FrameSet, xMin: number, xMax: number, numX: number, yMin: number, yMax: number, numY: number, forward: boolean);

export const onReady: Promise<void>;