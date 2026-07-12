import { DomainEvent } from './DomainEvent';

type EventHandler = (event: DomainEvent) => void | Promise<void>;

export class EventBus {
    private static instance: EventBus;
    private handlers: Map<string, EventHandler[]> = new Map();

    private constructor() {}

    public static getInstance(): EventBus {
        if (!EventBus.instance) {
            EventBus.instance = new EventBus();
        }
        return EventBus.instance;
    }

    public subscribe(eventName: string, handler: EventHandler): void {
        const currentHandlers = this.handlers.get(eventName) || [];
        currentHandlers.push(handler);
        this.handlers.set(eventName, currentHandlers);
    }

    public async publish(event: DomainEvent): Promise<void> {
        const handlers = this.handlers.get(event.eventName) || [];
        for (const handler of handlers) {
            await handler(event);
        }
    }
}