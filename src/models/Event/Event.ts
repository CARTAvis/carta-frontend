import {CARTA} from "carta-protobuf";

// class Event is a simple wrapper for CARTA.EventType
export class Event {
    public static readonly EVENT_TYPES = Object.values(CARTA.EventType) as CARTA.EventType[];
    public static readonly EVENT_NUMBER = Event.EVENT_TYPES.length;

    public static IsTypeValid = (eventType: CARTA.EventType): boolean => {
        return Event.EVENT_TYPES.includes(eventType);
    };

    public static GetNameFromType = (eventType: CARTA.EventType): string => {
        return CARTA.EventType[eventType];
    };
}

export function GetEventList(list: number[], value: number[] | number): number[] {
    if (!list || !Array.isArray(list)) {
        list = [];
    }

    const valueList = typeof value === "number" ? [value] : value;

    valueList.forEach(x => {
        if (list.includes(x)) {
            list = list.filter(e => e !== x);
        } else {
            list.push(x);
        }
    });

    return list;
}
