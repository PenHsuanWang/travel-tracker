"""Lightweight synchronous in-process event bus.

This minimal EventBus provides a publish/subscribe mechanism used by
services to emit lifecycle events (for example, ``GPX_PROCESSED``).
Handlers are invoked synchronously in the same thread; in production
systems consider using an async queue or external broker for resilience.

Event payloads are free-form dictionaries; consumers should document the
expected payload schema per event type (e.g., ``GPX_PROCESSED`` includes
``trip_id``, ``stats``, and ``member_ids``).
"""

from collections import defaultdict
from typing import Callable, List, Dict, Any
import logging

logger = logging.getLogger(__name__)


class EventBus:
    """Simple synchronous publish/subscribe helper.

    Usage:
        EventBus.subscribe("GPX_PROCESSED", handler_fn)
        EventBus.publish("GPX_PROCESSED", {"trip_id": "...", ...})
    """

    _subscribers: Dict[str, List[Callable]] = defaultdict(list)

    @classmethod
    def subscribe(cls, event_type: str, handler: Callable):
        """Subscribe a handler to an event type.

        Args:
            event_type (str): Event name.
            handler (Callable): Callable accepting a payload dict.
        """
        cls._subscribers[event_type].append(handler)
        logger.info(f"Subscribed {handler.__name__} to {event_type}")

    @classmethod
    def publish(cls, event_type: str, payload: Dict[str, Any]):
        """Publish an event with a payload to all subscribers.

        Handlers are called synchronously; exceptions from handlers are
        logged but do not stop other handlers from running.

        Args:
            event_type (str): Event name.
            payload (Dict[str, Any]): Event payload.
        """
        logger.info(f"Publishing event: {event_type}")
        for handler in cls._subscribers[event_type]:
            try:
                # In a real production system, this should be async or offloaded to a queue
                handler(payload)
            except Exception as e:
                logger.error(f"Error in event handler {handler.__name__} for {event_type}: {e}")
