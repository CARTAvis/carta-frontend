import {HipsCoord, HipsProjection, HipsQueryStore} from "./HipsQueryStore";

const mockLoadRemoteFile = jest.fn();
jest.mock("stores", () => ({
    AppStore: {
        Instance: {
            loadRemoteFile: x => mockLoadRemoteFile(x)
        }
    }
}));

describe("HipsQueryStore", () => {
    const store = HipsQueryStore.Instance;

    it("initializes with default values", () => {
        expect(store.hipsSurvey).toBe("");
        expect(store.size).toEqual({x: NaN, y: NaN});
        expect(store.object).toBe("");
        expect(store.center).toEqual({x: NaN, y: NaN});
        expect(store.fov).toBeNaN();
        expect(store.coordsys).toBe(HipsCoord.Icrs);
        expect(store.projection).toBe(HipsProjection.TAN);
        expect(store.rotationAngle).toBe(0);
        expect(store.isLoading).toBe(false);
    });

    it("sets the HiPS survey to be used", () => {
        store.setHipsSurvey("survey1");
        expect(store.hipsSurvey).toBe("survey1");
    });

    it("sets the image size", () => {
        store.setWidth(100);
        store.setHeight(200);
        expect(store.size).toEqual({x: 100, y: 200});
    });

    it("sets the object name", () => {
        store.setObject("object1");
        expect(store.object).toBe("object1");
    });

    it("sets the center coordinates", () => {
        store.setCenterX(123.45);
        store.setCenterY(67.89);
        expect(store.center).toEqual({x: 123.45, y: 67.89});
    });

    it("sets the field of view", () => {
        store.setFov(1.23);
        expect(store.fov).toBe(1.23);
    });

    it("sets the coordinate system", () => {
        store.setCoordsys(HipsCoord.Galactic);
        expect(store.coordsys).toBe(HipsCoord.Galactic);
    });

    it("sets the projection type", () => {
        store.setProjection(HipsProjection.SIN);
        expect(store.projection).toBe(HipsProjection.SIN);
    });

    it("sets the rotation angle", () => {
        store.setRotationAngle(45);
        expect(store.rotationAngle).toBe(45);
    });

    it("sets the query status", () => {
        store.setIsLoading(true);
        expect(store.isLoading).toBe(true);
    });

    it("resets the parameters", () => {
        store.clear();

        expect(store.hipsSurvey).toBe("");
        expect(store.size).toEqual({x: NaN, y: NaN});
        expect(store.object).toBe("");
        expect(store.center).toEqual({x: NaN, y: NaN});
        expect(store.fov).toBeNaN();
        expect(store.coordsys).toBe(HipsCoord.Icrs);
        expect(store.projection).toBe(HipsProjection.TAN);
        expect(store.rotationAngle).toBe(0);
    });

    it("checks if the parameters are valid", () => {
        expect(store.isValid).toBe(false);

        store.setHipsSurvey("survey1");
        store.setWidth(100);
        store.setHeight(200);
        store.setObject("object1");
        store.setFov(1.23);
        store.setRotationAngle(45);
        store.setIsLoading(false);
        expect(store.isValid).toBe(true);

        store.setObject("");
        expect(store.isValid).toBe(false);

        store.setCenterX(123.45);
        store.setCenterY(67.89);
        expect(store.isValid).toBe(true);

        store.setIsLoading(true);
        expect(store.isValid).toBe(false);
    });

    it("queries by the object name", async () => {
        const message = {
            hips: "survey1",
            width: 100,
            height: 200,
            object: "object1",
            fov: 1.23,
            coordsys: HipsCoord.Icrs,
            projection: HipsProjection.TAN,
            rotationAngle: 45
        };

        store.setObject("object1");
        store.setIsLoading(false);

        await store.queryByObject();
        expect(mockLoadRemoteFile).toHaveBeenCalledWith(message);
    });

    it("queries by the center coordinates", async () => {
        const message = {
            hips: "survey1",
            width: 100,
            height: 200,
            ra: 123.45,
            dec: 67.89,
            fov: 1.23,
            coordsys: HipsCoord.Icrs,
            projection: HipsProjection.TAN,
            rotationAngle: 45
        };

        await store.queryByCenter();
        expect(mockLoadRemoteFile).toHaveBeenCalledWith(message);
    });
});
