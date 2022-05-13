import { Event, EventHint, Options, SessionContext, Severity, Transport } from '@sentry/types';
import { isDebugBuild, logger, SentryError } from '@sentry/utils';

import { initAPIDetails } from './api';
import { createEventEnvelope, createSessionEnvelope } from './request';
import { NewTransport } from './transports/base';
import { NoopTransport } from './transports/noop';

/**
 * Internal platform-dependent Sentry SDK Backend.
 *
 * While {@link Client} contains business logic specific to an SDK, the
 * Backend offers platform specific implementations for low-level operations.
 * These are persisting and loading information, sending events, and hooking
 * into the environment.
 *
 * Backends receive a handle to the Client in their constructor. When a
 * Backend automatically generates events, it must pass them to
 * the Client for validation and processing first.
 *
 * Usually, the Client will be of corresponding type, e.g. NodeBackend
 * receives NodeClient. However, higher-level SDKs can choose to instantiate
 * multiple Backends and delegate tasks between them. In this case, an event
 * generated by one backend might very well be sent by another one.
 *
 * The client also provides access to options via {@link Client.getOptions}.
 * @hidden
 */
export interface Backend {
  /** Creates an {@link Event} from all inputs to `captureException` and non-primitive inputs to `captureMessage`. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  eventFromException(exception: any, hint?: EventHint): PromiseLike<Event>;

  /** Creates an {@link Event} from primitive inputs to `captureMessage`. */
  eventFromMessage(message: string, level?: Severity, hint?: EventHint): PromiseLike<Event>;

  /** Submits the event to Sentry */
  sendEvent(event: Event): void;

  /** Submits the session to Sentry */
  sendSession(session: SessionContext): void;

  /**
   * Returns the transport that is used by the backend.
   * Please note that the transport gets lazy initialized so it will only be there once the first event has been sent.
   *
   * @returns The transport.
   */
  getTransport(): Transport;
}

/**
 * A class object that can instantiate Backend objects.
 * @hidden
 */
export type BackendClass<B extends Backend, O extends Options> = new (options: O) => B;

/**
 * This is the base implemention of a Backend.
 * @hidden
 */
export abstract class BaseBackend<O extends Options> implements Backend {
  /** Options passed to the SDK. */
  protected readonly _options: O;

  /** Cached transport used internally. */
  protected _transport: Transport;

  /** New v7 Transport that is initialized alongside the old one */
  protected _newTransport?: NewTransport;

  /** Creates a new backend instance. */
  public constructor(options: O) {
    this._options = options;
    if (!this._options.dsn) {
      isDebugBuild() && logger.warn('No DSN provided, backend will not do anything.');
    }
    this._transport = this._setupTransport();
  }

  /**
   * @inheritDoc
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
  public eventFromException(_exception: any, _hint?: EventHint): PromiseLike<Event> {
    throw new SentryError('Backend has to implement `eventFromException` method');
  }

  /**
   * @inheritDoc
   */
  public eventFromMessage(_message: string, _level?: Severity, _hint?: EventHint): PromiseLike<Event> {
    throw new SentryError('Backend has to implement `eventFromMessage` method');
  }

  /**
   * @inheritDoc
   */
  public sendEvent(event: Event): void {
    // TODO(v7): Remove the if-else
    if (
      this._newTransport &&
      this._options.dsn &&
      this._options._experiments &&
      this._options._experiments.newTransport
    ) {
      const api = initAPIDetails(this._options.dsn, this._options._metadata, this._options.tunnel);
      const env = createEventEnvelope(event, api);
      void this._newTransport.send(env).then(null, reason => {
        isDebugBuild() && logger.error('Error while sending event:', reason);
      });
    } else {
      void this._transport.sendEvent(event).then(null, reason => {
        isDebugBuild() && logger.error('Error while sending event:', reason);
      });
    }
  }

  /**
   * @inheritDoc
   */
  public sendSession(session: SessionContext): void {
    if (!this._transport.sendSession) {
      isDebugBuild() && logger.warn("Dropping session because custom transport doesn't implement sendSession");
      return;
    }

    // TODO(v7): Remove the if-else
    if (
      this._newTransport &&
      this._options.dsn &&
      this._options._experiments &&
      this._options._experiments.newTransport
    ) {
      const api = initAPIDetails(this._options.dsn, this._options._metadata, this._options.tunnel);
      const [env] = createSessionEnvelope(session, api);
      void this._newTransport.send(env).then(null, reason => {
        isDebugBuild() && logger.error('Error while sending session:', reason);
      });
    } else {
      void this._transport.sendSession(session).then(null, reason => {
        isDebugBuild() && logger.error('Error while sending session:', reason);
      });
    }
  }

  /**
   * @inheritDoc
   */
  public getTransport(): Transport {
    return this._transport;
  }

  /**
   * Sets up the transport so it can be used later to send requests.
   */
  protected _setupTransport(): Transport {
    return new NoopTransport();
  }
}
