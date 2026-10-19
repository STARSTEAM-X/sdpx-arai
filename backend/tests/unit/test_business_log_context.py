import json
import logging
import time

from app.observability import JsonFormatter, request_id_var, request_start_var


def test_business_events_include_request_correlation_and_elapsed_time():
    request_token = request_id_var.set("request-business-1")
    start_token = request_start_var.set(time.perf_counter() - 0.05)
    try:
        record = logging.LogRecord("paireval.test", logging.INFO, "", 0, "", (), None)
        record.event_name = "comparison_saved"
        record.fields = {"email": "private@example.com"}
        payload = json.loads(JsonFormatter().format(record))
    finally:
        request_start_var.reset(start_token)
        request_id_var.reset(request_token)
    assert payload["event"] == "comparison_saved"
    assert payload["requestId"] == "request-business-1"
    assert payload["duration_ms"] >= 50
    assert "private@example.com" not in json.dumps(payload)
