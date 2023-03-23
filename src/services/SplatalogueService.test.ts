import {SplatalogueService} from "services";

let mockAxiosPost = jest.fn();
jest.mock("axios", () => {
    return {
        create: () => {
            return {
                post: mockAxiosPost
            };
        }
    };
});

describe("SplatalogueService", () => {
    test("query with corrent parameters when intensity limit is disabled", () => {
        mockAxiosPost.mockImplementationOnce(() => {
            return {data: []};
        });
        SplatalogueService.Instance.query(300000, 300100, NaN);
        const params = JSON.parse(mockAxiosPost.mock.calls[0][1].body);
        expect(params).toHaveProperty("lineIntensity", "None");
    });

    test("query with corrent parameters when intensity limit is enabled", () => {
        mockAxiosPost.mockImplementationOnce(() => {
            return {data: []};
        });
        SplatalogueService.Instance.query(300000, 300100, -5);
        const params = JSON.parse(mockAxiosPost.mock.calls[0][1].body);
        expect(params).toHaveProperty("lineIntensity", "CDMS/JPL (log)");
        expect(params).toHaveProperty("lineIntensityLowerLimit", -5);
    });

    test("query with corrent parameters when intensity limit is 0", () => {
        mockAxiosPost.mockImplementationOnce(() => {
            return {data: []};
        });
        SplatalogueService.Instance.query(300000, 300100, 0);
        const params = JSON.parse(mockAxiosPost.mock.calls[0][1].body);
        expect(params).toHaveProperty("lineIntensity", "CDMS/JPL (log)");
        expect(params).toHaveProperty("lineIntensityLowerLimit", 0.000001);
    });

    test("returns correct parsed string", async () => {
        mockAxiosPost.mockImplementationOnce(() => {
            return {
                data: [
                    {
                        name: 'KF <font color="red"><i>v</i> = 0</font>',
                        orderedFreq: "381543.5091 (0.0109), <span style = 'color: #DC143C'>381543.5091</span>"
                    },
                    {}
                ]
            };
        });
        const ack = await SplatalogueService.Instance.query(300000, 300100, NaN);
        expect(ack.spectralLineData[0].stringData[0]).toEqual("KF v = 0");
        expect(ack.spectralLineData[3].stringData[0]).toEqual("381543.5091");
        expect(ack.spectralLineData[4].stringData[0]).toEqual("0.0109");
    });
});
