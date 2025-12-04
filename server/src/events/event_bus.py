from collections import defaultdict
from typing import Callable, List, Dict, Any
import logging

logger = logging.getLogger(__name__)

class EventBus:
    _subscribers: Dict[str, List[Callable]] = defaultdict(list)

    @classmethod
    def subscribe(cls, event_type: str, handler: Callable):
        cls._subscribers[event_type].append(handler)
        logger.info(f"Subscribed {handler.__name__} to {event_type}")

    @classmethod
    def publish(cls, event_type: str, payload: Dict[str, Any]):
        logger.info(f"Publishing event: {event_type}")
        for handler in cls._subscribers[event_type]:
            try:
                # In a real production system, this should be async or offloaded to a queue
                handler(payload)
            except Exception as e:
                logger.error(f"Error in event handler {handler.__name__} for {event_type}: {e}")
