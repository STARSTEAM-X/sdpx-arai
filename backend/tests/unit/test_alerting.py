"""NFR-OBS-02 — error rate > 1% ต่อเนื่อง 5 นาที หรือ p95 เกินเป้า 2 เท่า"""
from app import alerting
from app.alerting import AlertMonitor, p95

AUTOSAVE = ("PUT", "/api/comparisons/{pair_assignment_id}")  # เป้า p95 300 ms
T0 = 1_000 * 60  # ต้นนาที


def _traffic(monitor, minute, *, total=100, errors=0, route=("GET", "/api/me"), duration=10.0):
    for i in range(total):
        monitor.record(method=route[0], route=route[1], status_code=500 if i < errors else 200,
                       duration_ms=duration, now=T0 + minute * 60 + 1)


def test_p95_nearest_rank():
    assert p95(list(range(1, 101))) == 95
    assert p95([5.0]) == 5.0


def test_error_rate_above_1pct_for_5_full_minutes_fires_once_then_resolves():
    monitor = AlertMonitor()
    for minute in range(5):
        _traffic(monitor, minute, errors=2)
    fired = monitor.evaluate(T0 + 5 * 60)
    assert [c["alert"] for c in fired] == ["error_rate"] and fired[0]["state"] == "firing"
    assert fired[0]["errorRate"] == 0.02

    _traffic(monitor, 5, errors=2)
    assert monitor.evaluate(T0 + 6 * 60) == []  # ยังผิดปกติอยู่ ไม่แจ้งซ้ำ

    _traffic(monitor, 6, errors=0)
    assert monitor.evaluate(T0 + 7 * 60) == [{"alert": "error_rate", "state": "resolved"}]


def test_error_rate_needs_every_minute_not_just_a_spike():
    monitor = AlertMonitor()
    for minute in range(5):
        _traffic(monitor, minute, errors=50 if minute == 2 else 0)
    assert monitor.evaluate(T0 + 5 * 60) == []


def test_exactly_1pct_and_client_errors_do_not_fire():
    monitor = AlertMonitor()
    for minute in range(5):
        _traffic(monitor, minute, errors=1)  # 1% พอดี — เงื่อนไขคือ "เกิน" 1%
        monitor.record(method="GET", route="/api/me", status_code=404, duration_ms=1, now=T0 + minute * 60 + 2)
    assert monitor.evaluate(T0 + 5 * 60) == []


def test_minute_without_traffic_breaks_continuity():
    monitor = AlertMonitor()
    for minute in (0, 1, 3, 4):
        _traffic(monitor, minute, errors=10)
    assert monitor.evaluate(T0 + 5 * 60) == []


def test_p95_over_twice_target_fires_for_that_route():
    monitor = AlertMonitor()
    _traffic(monitor, 0, total=30, route=AUTOSAVE, duration=650.0)
    fired = monitor.evaluate(T0 + 60)
    assert fired == [{"alert": "p95:PUT /api/comparisons/{pair_assignment_id}", "state": "firing",
                      "route": "PUT /api/comparisons/{pair_assignment_id}", "p95Ms": 650.0, "targetMs": 300,
                      "samples": 30}]


def test_p95_at_twice_target_or_too_few_samples_does_not_fire():
    monitor = AlertMonitor()
    _traffic(monitor, 0, total=30, route=AUTOSAVE, duration=600.0)
    _traffic(monitor, 0, total=5, route=("POST", "/api/assignments/{assignment_id}/submissions"), duration=5000.0)
    assert monitor.evaluate(T0 + 60) == []


def test_old_minutes_fall_out_of_window():
    monitor = AlertMonitor()
    _traffic(monitor, 0, total=30, route=AUTOSAVE, duration=900.0)
    assert monitor.evaluate(T0 + 60)[0]["state"] == "firing"
    assert monitor.evaluate(T0 + 7 * 60) == [{"alert": "p95:PUT /api/comparisons/{pair_assignment_id}",
                                              "state": "resolved"}]


def test_notify_logs_and_posts_webhook_without_raising(monkeypatch):
    sent = []
    monkeypatch.setattr(alerting, "ALERT_WEBHOOK_URL", "https://hooks.example.test/x")
    monkeypatch.setattr(alerting, "_post_webhook", lambda payload: sent.append(payload) or 1 / 0)
    alerting.notify([{"alert": "error_rate", "state": "firing"}])  # webhook พังต้องไม่ทำให้ loop ตาย
    assert sent == [{"alert": "error_rate", "state": "firing"}]


def test_GAP10_หน้า_Evaluation_มีเป้า_p95_และแจ้งเตือนเมื่อเกิน_2_เท่า():
    evaluation = ("GET", "/api/assignments/{assignment_id}/my-evaluations")
    assert evaluation in alerting.P95_TARGET_MS

    monitor = AlertMonitor()
    slow = alerting.P95_TARGET_MS[evaluation] * alerting.LATENCY_FACTOR + 1
    for minute in range(5):
        _traffic(monitor, minute, total=30, route=evaluation, duration=slow)
    fired = monitor.evaluate(T0 + 5 * 60)

    assert any(c["state"] == "firing" and "my-evaluations" in str(c) for c in fired)


def test_GAP10_webhook_ของ_Discord_ใช้ช่อง_content_ส่วน_Slack_ใช้_text():
    change = {"alert": "error_rate", "state": "firing", "errorRate": 0.02}

    discord = alerting.webhook_body("https://discord.com/api/webhooks/1/abc", change)
    slack = alerting.webhook_body("https://hooks.slack.com/services/T/B/x", change)

    # Discord ปฏิเสธข้อความที่ไม่มี content ("Cannot send an empty message")
    assert discord == {"content": "[PairEval] firing: error_rate (errorRate=0.02)"}
    assert slack["text"].startswith("[PairEval] firing: error_rate") and slack["errorRate"] == 0.02
