import {CARTA} from "carta-protobuf";

import {momentsMade} from "./MomentDefinition";

describe("momentsMade", () => {
    test("pairs each image with the moment asked for in its place", () => {
        expect(momentsMade([CARTA.Moment.MAX_OF_THE_SPECTRUM, CARTA.Moment.INTEGRATED_OF_THE_SPECTRUM], 2)).toEqual([CARTA.Moment.MAX_OF_THE_SPECTRUM, CARTA.Moment.INTEGRATED_OF_THE_SPECTRUM]);
    });

    test("skips the median coordinate the backend left out", () => {
        expect(momentsMade([CARTA.Moment.INTEGRATED_OF_THE_SPECTRUM, CARTA.Moment.MEDIAN_COORDINATE, CARTA.Moment.MAX_OF_THE_SPECTRUM], 2)).toEqual([CARTA.Moment.INTEGRATED_OF_THE_SPECTRUM, CARTA.Moment.MAX_OF_THE_SPECTRUM]);
    });

    test("cannot tell the images apart when any other moment is missing", () => {
        expect(momentsMade([CARTA.Moment.INTEGRATED_OF_THE_SPECTRUM, CARTA.Moment.MAX_OF_THE_SPECTRUM], 1)).toBeUndefined();
        expect(momentsMade([CARTA.Moment.INTEGRATED_OF_THE_SPECTRUM], 3)).toBeUndefined();
    });
});
