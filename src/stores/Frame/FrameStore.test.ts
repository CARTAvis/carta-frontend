import {CARTA} from "carta-protobuf";

import {FrameInfo, FrameStore} from "stores";

const stokesCubeframeInfo: FrameInfo = {
    fileId: 0,
    directory: "",
    hdu: "",
    fileInfo: new CARTA.FileInfo({HDUList: ["0"], name: "", size: 17280, type: 3}),
    fileInfoExtended: new CARTA.FileInfoExtended({
        dimensions: 4,
        height: 2,
        width: 2,
        depth: 3,
        stokes: 2,
        axesNumbers: {spatialX: 1, spatialY: 2, spectral: 3, stokes: 4, depth: 3},
        headerEntries: [
            {name: "CTYPE1", value: "RA---SIN"},
            {name: "CRVAL1", value: "1.469895377994E+02", entryType: 1, numericValue: 146.9895377994},
            {name: "CDELT1", value: "-5.000000000000E-05", entryType: 1, numericValue: -0.00005},
            {name: "CRPIX1", value: "-2", entryType: 1, numericValue: -2},
            {name: "CUNIT1", value: "deg"},
            {name: "CTYPE2", value: "DEC--SIN"},
            {name: "CRVAL2", value: "1.327891127641E+01", entryType: 1, numericValue: 13.27891127641},
            {name: "CDELT2", value: "5.000000000000E-05", entryType: 1, numericValue: 0.00005},
            {name: "CRPIX2", value: "2", entryType: 1, numericValue: 2},
            {name: "CUNIT2", value: "deg"},
            {name: "CTYPE3", value: "FREQ"},
            {name: "CRVAL3", value: "3.440912937187E+11", entryType: 1, numericValue: 344091293718.7},
            {name: "CDELT3", value: "3.906722973755E+06", entryType: 1, numericValue: 3906722.973755},
            {name: "CRPIX3", value: "1", entryType: 1, numericValue: 1},
            {name: "CUNIT3", value: "Hz"},
            {name: "CTYPE4", value: "STOKES"},
            {name: "CRVAL4", value: "1.000000000000E+00", entryType: 1, numericValue: 1},
            {name: "CDELT4", value: "1.000000000000E+00", entryType: 1, numericValue: 1},
            {name: "CRPIX4", value: "1", entryType: 1, numericValue: 1},
            {name: "CUNIT4"}
        ]
    }),
    fileFeatureFlags: 0,
    renderMode: CARTA.RenderMode.RASTER,
    beamTable: [
        new CARTA.Beam({majorAxis: 0.9315811991691589, minorAxis: 0.8433393239974976, pa: 42.576087951660156}),
        new CARTA.Beam({channel: 1, majorAxis: 0.9315744042396545, minorAxis: 0.8433324098587036, pa: 42.5771484375}),
        new CARTA.Beam({channel: 2, majorAxis: 0.9315680265426636, minorAxis: 0.843326985836029, pa: 42.57808303833008}),
        new CARTA.Beam({stokes: 1, majorAxis: 0.931560754776001, minorAxis: 0.8433191776275635, pa: 42.579010009765625}),
        new CARTA.Beam({channel: 1, stokes: 1, majorAxis: 0.9315542578697205, minorAxis: 0.8433099985122681, pa: 42.58040237426758}),
        new CARTA.Beam({channel: 2, stokes: 1, majorAxis: 0.9315447807312012, minorAxis: 0.8433027863502502, pa: 42.58256912231445})
    ]
};

describe("FrameStore", () => {
    describe("beamProperties", () => {
        test("returns the beam of the current channel and stokes", () => {
            const frame = new FrameStore(stokesCubeframeInfo);
            const beam = frame.beamProperties;
            expect(beam).toHaveProperty("majorAxis", 0.9315811991691589);
            expect(beam).toHaveProperty("minorAxis", 0.8433393239974976);
            expect(beam).toHaveProperty("angle", 42.576087951660156);
        });
    });

    describe("beamAllChannels", () => {
        test("returns a list of beams from all channels with the current stokes", () => {
            const frame = new FrameStore(stokesCubeframeInfo);
            let beams = frame.beamAllChannels;
            expect(beams).toHaveLength(3);
            expect(beams[1]).toHaveProperty("majorAxis", 0.9315744042396545);
            expect(beams[1]).toHaveProperty("minorAxis", 0.8433324098587036);
            expect(beams[1]).toHaveProperty("pa", 42.5771484375);

            frame.setChannels(0, 1, false);
            beams = frame.beamAllChannels;
            expect(beams).toHaveLength(3);
            expect(beams[2]).toHaveProperty("majorAxis", 0.9315447807312012);
            expect(beams[2]).toHaveProperty("minorAxis", 0.8433027863502502);
            expect(beams[2]).toHaveProperty("pa", 42.58256912231445);
        });
    });
});
