import pytest
import logging
from unittest.mock import MagicMock

from src.events.event_bus import EventBus

# Fixture to ensure the event bus is clean for each test
@pytest.fixture(autouse=True)
def clean_event_bus():
    # Before the test, clear subscribers
    original_subscribers = EventBus._subscribers.copy()
    EventBus._subscribers.clear()
    
    yield
    
    # After the test, restore original state
    EventBus._subscribers = original_subscribers

def test_subscribe_and_publish():
    handler = MagicMock(__name__='handler')
    EventBus.subscribe("test_event", handler)
    
    payload = {"data": "value"}
    EventBus.publish("test_event", payload)
    
    handler.assert_called_once_with(payload)

def test_multiple_handlers_for_one_event():
    handler1 = MagicMock(__name__='handler1')
    handler2 = MagicMock(__name__='handler2')
    
    EventBus.subscribe("multi_event", handler1)
    EventBus.subscribe("multi_event", handler2)
    
    payload = {"info": "A"}
    EventBus.publish("multi_event", payload)
    
    handler1.assert_called_once_with(payload)
    handler2.assert_called_once_with(payload)

def test_event_isolation():
    handler_a = MagicMock(__name__='handler_a')
    handler_b = MagicMock(__name__='handler_b')
    
    EventBus.subscribe("event_A", handler_a)
    EventBus.subscribe("event_B", handler_b)
    
    payload_A = {"source": "A"}
    EventBus.publish("event_A", payload_A)
    
    handler_a.assert_called_once_with(payload_A)
    handler_b.assert_not_called()

def test_handler_exception_does_not_stop_others(caplog):
    def failing_handler(payload):
        raise ValueError("Handler Failed")
    failing_handler.__name__ = 'failing_handler'
        
    handler1 = MagicMock(side_effect=failing_handler, __name__='failing_handler_mock')
    handler2 = MagicMock(__name__='handler2')
    
    # We need to subscribe the actual function to test the logging of its name
    EventBus.subscribe("error_event", failing_handler)
    EventBus.subscribe("error_event", handler2)
    
    payload = {"data": "ignore"}
    
    with caplog.at_level(logging.ERROR):
        EventBus.publish("error_event", payload)
    
    handler2.assert_called_once_with(payload)
    
    # Check that the error was logged
    assert "Error in event handler failing_handler" in caplog.text
    assert "Handler Failed" in caplog.text

def test_publish_to_event_with_no_subscribers():
    # This should not raise any error
    try:
        EventBus.publish("unsubscribed_event", {"data": "silent"})
    except Exception as e:
        pytest.fail(f"Publishing to an event with no subscribers raised an exception: {e}")
