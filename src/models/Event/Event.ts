import {CARTA} from "carta-protobuf";

// class Event is a simple wrapper for CARTA.EventType
export class Event {
    public static readonly EVENT_TYPES = Object.values(CARTA.EventType) as CARTA.EventType[];
    public static readonly EVENT_NUMBER = Event.EVENT_TYPES.length;

    public static isEventTypeValid = (eventType: CARTA.EventType): boolean => {
        return Event.EVENT_TYPES.includes(eventType);
    };

    public static getEventTypeFromName = (eventName: string): CARTA.EventType => {
        return CARTA.EventType[eventName];
    };

    public static getEventNameFromType = (eventType: CARTA.EventType): string => {
        return CARTA.EventType[eventType];
    };
}
