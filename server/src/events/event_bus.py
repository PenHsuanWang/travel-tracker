"""Simple in-memory pub/sub primitive for domain events."""

import logging
from collections import defaultdict
from typing import Any, Callable, Dict, List

logger = logging.getLogger(__name__)


class EventBus:
    """Lightweight synchronous publish/subscribe dispatcher."""

    _subscribers: Dict[str, List[Callable]] = defaultdict(list)

    @classmethod
    def subscribe(cls, event_type: str, handler: Callable) -> None:
        """
        Register a handler for the given event type.

        :param event_type: Name of the event to subscribe to.
        :param handler: Callable invoked with the published payload.
        """

        cls._subscribers[event_type].append(handler)
        logger.info("Subscribed %s to %s", handler.__name__, event_type)

    @classmethod
    def publish(cls, event_type: str, payload: Dict[str, Any]) -> None:
        """
        Publish an event payload to every subscribed handler.

        :param event_type: Name used to route the payload.
        :param payload: Arbitrary dictionary delivered to subscribers.
        """

        logger.info("Publishing event: %s", event_type)
        for handler in cls._subscribers[event_type]:
            try:
                handler(payload)
            except Exception as exc:  # noqa: BLE001
                logger.error(
                    "Error in event handler %s for %s: %s",
                    handler.__name__,
                    event_type,
                    exc,
                )
