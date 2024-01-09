import {getEventList} from "./Event";

describe("Log Event", () => {
    test("if Event list properly adds/removes elements", () => {
        let EventList = [1, 2, 3];
        EventList = getEventList(EventList, 4);
        expect(EventList).toStrictEqual([1, 2, 3, 4]);

        EventList = getEventList(EventList, 2);
        expect(EventList).toStrictEqual([1, 3, 4]);
    });
});
