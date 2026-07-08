// NoteForge — EventBus
// Lightweight typed event emitter for editor-internal communication.
// Decouples UI components from controller logic.

import type { EditorEventMap, EventHandler, Unsubscribe } from '../types/events';

export class EventBus {
  private listeners = new Map<string, Set<EventHandler>>();
  private onceListeners = new Map<string, Set<EventHandler>>();

  /** Subscribe to an event. Returns an unsubscribe function. */
  on<K extends keyof EditorEventMap>(
    event: K,
    handler: EventHandler<EditorEventMap[K]>,
  ): Unsubscribe;
  on(event: string, handler: EventHandler): Unsubscribe {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
    return () => {
      this.listeners.get(event)?.delete(handler);
    };
  }

  /** Subscribe to a single-shot event */
  once<K extends keyof EditorEventMap>(
    event: K,
    handler: EventHandler<EditorEventMap[K]>,
  ): Unsubscribe;
  once(event: string, handler: EventHandler): Unsubscribe {
    if (!this.onceListeners.has(event)) {
      this.onceListeners.set(event, new Set());
    }
    this.onceListeners.get(event)!.add(handler);
    return () => {
      this.onceListeners.get(event)?.delete(handler);
    };
  }

  /** Emit an event with a payload */
  emit<K extends keyof EditorEventMap>(
    event: K,
    payload: EditorEventMap[K],
  ): void;
  emit(event: string, payload: unknown): void {
    this.listeners.get(event)?.forEach((handler) => {
      try { handler(payload); } catch (e) { console.error(`[EventBus] Error in handler for "${event}":`, e); }
    });
    this.onceListeners.get(event)?.forEach((handler) => {
      try { handler(payload); } catch (e) { console.error(`[EventBus] Error in once-handler for "${event}":`, e); }
    });
    this.onceListeners.delete(event);
  }

  /** Remove all listeners for an event, or all events */
  clear(event?: string): void {
    if (event) {
      this.listeners.delete(event);
      this.onceListeners.delete(event);
    } else {
      this.listeners.clear();
      this.onceListeners.clear();
    }
  }

  /** Number of listeners for a given event */
  listenerCount(event: string): number {
    return (this.listeners.get(event)?.size ?? 0) + (this.onceListeners.get(event)?.size ?? 0);
  }
}

/** Singleton instance for the editor module */
export const eventBus = new EventBus();
