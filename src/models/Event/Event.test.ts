import {GetEventList} from "./Event";

describe("GetEventList", () => {
    test("properly adds/removes elements", () => {
        let eventList = [1, 2, 3];
        eventList = GetEventList(eventList, 4);
        expect(eventList).toStrictEqual([1, 2, 3, 4]);

        eventList = GetEventList(eventList, 2);
        expect(eventList).toStrictEqual([1, 3, 4]);

        eventList = GetEventList(eventList, [3, 5]);
        expect(eventList).toStrictEqual([1, 4, 5]);
    });
});
