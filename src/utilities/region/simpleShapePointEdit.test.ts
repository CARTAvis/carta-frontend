import {CARTA} from "carta-protobuf";

import {getMovedSimpleShapeSide, SIMPLE_SHAPE_RIGHT_POINT_INDEX} from "./simpleShapePointEdit";

describe("simple shape point editing", () => {
    test("applies independent text scaling after rotation", () => {
        const edit = getMovedSimpleShapeSide({
            regionType: CARTA.RegionType.ANNTEXT,
            center: {x: 0, y: 0},
            size: {x: 100, y: 40},
            rotation: 45,
            selectedPointIndex: SIMPLE_SHAPE_RIGHT_POINT_INDEX,
            delta: {x: 5 * Math.SQRT2, y: 2.5 * Math.SQRT2},
            textScale: {x: 0.5, y: 0.25}
        });

        expect(edit?.size).toEqual({x: 120, y: 40});
        expect(edit?.center.x).toBeCloseTo(2.5 * Math.SQRT2);
        expect(edit?.center.y).toBeCloseTo(1.25 * Math.SQRT2);
    });
});
