import { Event, EventType } from './event';
import { EventStatus } from './eventstatus';
import { SessionContext } from './session';

/** JSDoc */
export interface Response {
  status: EventStatus;
  event?: Event | SessionContext;
  type?: EventType;
  reason?: string;
}
