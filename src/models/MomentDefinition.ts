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
