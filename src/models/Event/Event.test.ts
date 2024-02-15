import {getEventList} from "./Event";

describe("getEventList", () => {
    test("properly adds/removes elements", () => {
        let eventList = [1, 2, 3];
        eventList = getEventList(eventList, 4);
        expect(eventList).toStrictEqual([1, 2, 3, 4]);

        eventList = getEventList(eventList, 2);
        expect(eventList).toStrictEqual([1, 3, 4]);

        eventList = getEventList(eventList, [3, 5]);
        expect(eventList).toStrictEqual([1, 4, 5]);
    });
});
