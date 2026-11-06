import {CARTA} from "carta-protobuf";

export const MOMENT_TEXT = new Map<CARTA.Moment, {tag: string; text: string}>([
    [CARTA.Moment.MEAN_OF_THE_SPECTRUM, {tag: "-1", text: "Mean value of the spectrum"}],
    [CARTA.Moment.INTEGRATED_OF_THE_SPECTRUM, {tag: "0", text: "Integrated value of the spectrum"}],
    [CARTA.Moment.INTENSITY_WEIGHTED_COORD, {tag: "1", text: "Intensity weighted coordinate"}],
    [CARTA.Moment.INTENSITY_WEIGHTED_DISPERSION_OF_THE_COORD, {tag: "2", text: "Intensity weighted dispersion of the coordinate"}],
    [CARTA.Moment.MEDIAN_OF_THE_SPECTRUM, {tag: "3", text: "Median value of the spectrum"}],
    [CARTA.Moment.MEDIAN_COORDINATE, {tag: "4", text: "Median coordinate"}],
    [CARTA.Moment.STD_ABOUT_THE_MEAN_OF_THE_SPECTRUM, {tag: "5", text: "Standard deviation about the mean of the spectrum"}],
    [CARTA.Moment.RMS_OF_THE_SPECTRUM, {tag: "6", text: "Root mean square of the spectrum"}],
    [CARTA.Moment.ABS_MEAN_DEVIATION_OF_THE_SPECTRUM, {tag: "7", text: "Absolute mean deviation of the spectrum"}],
    [CARTA.Moment.MAX_OF_THE_SPECTRUM, {tag: "8", text: "Maximum value of the spectrum"}],
    [CARTA.Moment.COORD_OF_THE_MAX_OF_THE_SPECTRUM, {tag: "9", text: "Coordinate of the maximum value of the spectrum"}],
    [CARTA.Moment.MIN_OF_THE_SPECTRUM, {tag: "10", text: "Minimum value of the spectrum"}],
    [CARTA.Moment.COORD_OF_THE_MIN_OF_THE_SPECTRUM, {tag: "11", text: "Coordinate of the minimum value of the spectrum"}]
]);

export const NONLINEAR_SPECTRAL_AXIS_UNSUPPORTED_MOMENTS: CARTA.Moment[] = [
    CARTA.Moment.INTEGRATED_OF_THE_SPECTRUM,
    CARTA.Moment.INTENSITY_WEIGHTED_COORD,
    CARTA.Moment.INTENSITY_WEIGHTED_DISPERSION_OF_THE_COORD,
    CARTA.Moment.MEDIAN_COORDINATE,
    CARTA.Moment.COORD_OF_THE_MAX_OF_THE_SPECTRUM,
    CARTA.Moment.COORD_OF_THE_MIN_OF_THE_SPECTRUM
];

/**
 * Returns the moment of each image that a moment request made, in the order that the backend sends
 * the images back.
 *
 * The backend makes the images in the order of the request. It leaves out the median coordinate
 * when the pixel range cannot give one.
 *
 * @param requested - the moments that the request asked for.
 * @param madeCount - the number of images that came back.
 * @returns nothing when the images cannot be told apart.
 */
export function momentsMade(requested: CARTA.Moment[], madeCount: number): CARTA.Moment[] | undefined {
    if (madeCount === requested.length) {
        return [...requested];
    }
    if (madeCount === requested.length - 1 && requested.includes(CARTA.Moment.MEDIAN_COORDINATE)) {
        return requested.filter(moment => moment !== CARTA.Moment.MEDIAN_COORDINATE);
    }
    return undefined;
}
