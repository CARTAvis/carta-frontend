jest.mock("stores", () => ({
    AppStore: {
        Instance: {
            overlaySettings: {
                isImgCoordinates: false,
                global: {explicitSystem: "ICRS"},
                numbers: {formatTypeX: "hms", formatTypeY: "dms"}
            }
        }
    }
}));
jest.mock("stores/Frame", () => ({WCS_PRECISION: 3}));
jest.mock("models", () => ({
    ...jest.requireActual("models/AngularSize/AngularSize"),
    ...jest.requireActual("models/Point2D/Point2D"),
    ...jest.requireActual("models/Wcs/WCSValidation")
}));
jest.mock("utilities", () => ({
    ...jest.requireActual("utilities/math/math"),
    ...jest.requireActual("utilities/units/units"),
    ...jest.requireActual("utilities/region/simpleShapePointEdit"),
    NUMBER_FORMAT_LABEL: new Map(),
    getFormattedWCSPoint: jest.fn(() => ({x: "00:00:00.000", y: "+00:00:00.000"})),
    getPixelValueFromWCS: jest.fn(),
    isWCSStringFormatValid: jest.fn(() => true)
}));
jest.mock("components/Shared", () => {
    const actualSafeNumericInput = jest.requireActual("components/Shared/SafeNumericInput/SafeNumericInput");
    const actualCoordNumericInput = jest.requireActual("components/Shared/CoordNumericInput/CoordNumericInput");
    return {
        ...actualSafeNumericInput,
        ...actualCoordNumericInput,
        CoordinateComponent: () => null
    };
});

import {fireEvent, render, screen} from "@testing-library/react";
import {CARTA} from "carta-protobuf";

import {CoordinateMode} from "enums";
import {MIN_EDITED_REGION_DIMENSION} from "utilities";

import {AnnulusRegionForm} from "./AnnulusRegionForm";

function makeProps(overrides: {region?: Partial<any>; frame?: Partial<any>; wcsInfo?: number} = {}) {
    const region = {
        regionType: CARTA.RegionType.ANNULUS,
        isAnnotation: false,
        name: "annulus-1",
        coordinate: CoordinateMode.Image,
        center: {x: 50, y: 60},
        size: {x: 10, y: 20},
        innerSize: {x: 5, y: 10},
        rotation: 0,
        controlPoints: [
            {x: 50, y: 60},
            {x: 10, y: 20},
            {x: 5, y: 10}
        ],
        setName: jest.fn(),
        setCoordinate: jest.fn(),
        setCenter: jest.fn(),
        setSize: jest.fn(),
        setInnerSize: jest.fn(),
        setRotation: jest.fn(),
        ...overrides.region
    };
    const frame = {
        hasSquarePixels: true,
        getAnnulusWcsAxisScale: jest.fn(() => ({x: 2, y: 4})),
        getAnnulusWcsSizeInArcsec: jest.fn((size: {x: number; y: number}) => ({x: size.x * 2, y: size.y * 4})),
        ...overrides.frame
    };
    return {
        region: region as any,
        frame: frame as any,
        wcsInfo: (overrides.wcsInfo ?? 1) as any
    };
}

describe("AnnulusRegionForm", () => {
    test("updates outer and inner axes in image coordinates", () => {
        const props = makeProps();
        render(<AnnulusRegionForm {...props} />);

        const outerInput = screen.getByTestId("annulus-outer-major-input") as HTMLInputElement;
        fireEvent.change(outerInput, {target: {value: "12"}});
        fireEvent.keyDown(outerInput, {key: "Enter"});
        expect(props.region.setSize).toHaveBeenCalledWith({x: 12, y: 20});

        const innerInput = screen.getByTestId("annulus-inner-minor-input") as HTMLInputElement;
        fireEvent.change(innerInput, {target: {value: "14"}});
        fireEvent.keyDown(innerInput, {key: "Enter"});
        expect(props.region.setInnerSize).toHaveBeenCalledWith({x: 5, y: 14}, false, "y");
    });

    test("avoids redundant updates and resets the input when an axis is already at its clamp limit", () => {
        const minOuter = MIN_EDITED_REGION_DIMENSION * 2;
        const maxInner = {x: 9.99, y: 19.98};
        const props = makeProps({
            region: {
                size: {x: minOuter, y: 20},
                innerSize: maxInner,
                controlPoints: [{x: 50, y: 60}, {x: minOuter, y: 20}, maxInner]
            }
        });
        render(<AnnulusRegionForm {...props} />);

        const outerInput = screen.getByTestId("annulus-outer-major-input") as HTMLInputElement;
        fireEvent.change(outerInput, {target: {value: "0.0005"}});
        fireEvent.blur(outerInput);
        expect(props.region.setSize).not.toHaveBeenCalled();
        expect(outerInput.value).toBe(String(minOuter));

        const innerProps = makeProps({
            region: {
                size: {x: 10, y: 20},
                innerSize: maxInner,
                controlPoints: [{x: 50, y: 60}, {x: 10, y: 20}, maxInner]
            }
        });
        render(<AnnulusRegionForm {...innerProps} />);

        const innerInputs = screen.getAllByTestId("annulus-inner-major-input") as HTMLInputElement[];
        const innerInput = innerInputs[1];
        fireEvent.change(innerInput, {target: {value: "50"}});
        fireEvent.keyDown(innerInput, {key: "Enter"});
        expect(innerProps.region.setInnerSize).not.toHaveBeenCalled();
        expect(innerInput.value).toBe(String(maxInner.x));
    });

    test("updates axes in world coordinates and disables WCS size inputs when WCS size is unavailable", () => {
        const props = makeProps({
            region: {coordinate: CoordinateMode.World}
        });
        const {rerender} = render(<AnnulusRegionForm {...props} />);

        const innerMajorInput = screen.getByTestId("annulus-inner-major-input") as HTMLInputElement;
        expect(innerMajorInput).toBeEnabled();
        expect(innerMajorInput.value).toBe('10.000"');

        fireEvent.change(innerMajorInput, {target: {value: '14"'}});
        fireEvent.keyDown(innerMajorInput, {key: "Enter"});
        expect(props.region.setInnerSize).toHaveBeenCalledWith({x: 7, y: 10}, false, "x");

        const invalidScaleProps = makeProps({
            region: {coordinate: CoordinateMode.World},
            frame: {getAnnulusWcsSizeInArcsec: jest.fn(() => ({x: NaN, y: NaN}))}
        });
        rerender(<AnnulusRegionForm {...invalidScaleProps} />);
        expect(screen.getByTestId("annulus-outer-major-input")).toBeDisabled();
        expect(screen.getByTestId("annulus-inner-minor-input")).toBeDisabled();
    });
});
