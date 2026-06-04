from pytest_bdd import scenarios, given, when, then, parsers
from unittest.mock import patch
from conftest import FAKE_SENDER_ID, FAKE_RECIPIENT_ID

scenarios("features/messaging.feature")

# ── BDD step definitions ─────────────────────────────────────────────────

@given("I am authenticated as a patient")
def authenticated(client):
    assert client is not None # client fixture ensures authentication override

@given("I am not authenticated")
def not_authenticated(anon_client, context):
    context["client"] = anon_client

@given("a message has been sent to me")
def message_in_inbox(context):
    context["seeded_message"] = {
        "id": "msg-uuid-001",
        "sender_id": FAKE_RECIPIENT_ID,
        "recipient_id": FAKE_SENDER_ID,
        "body": "Please review your test results.",
        "sent_at": "2026-05-25T10:00:00Z",
        "read_at": None,
    }

@when(parsers.parse("I send a message with body '{body}'"))
def send_message(client, context, body):
    used_client = context.get("client", client)
    with patch("messages.service.get_supabase_admin") as mock_sb:
        mock_sb.return_value.table.return_value.insert.return_value.execute.return_value.data = [{
            "id": "msg-uuid-999",
            "sender_id": FAKE_SENDER_ID,
            "recipient_id": FAKE_RECIPIENT_ID,
            "body": body,
            "sent_at": "2026-05-25T12:00:00Z",
            "read_at": None,
        }]
        context["response"] = used_client.post("/messages/", json={
            "recipient_id": FAKE_RECIPIENT_ID,
            "body": body,
        })

@when("I request my inbox")
def get_inbox(client, context):
    with patch("messages.service.get_supabase_admin") as mock_sb:
        mock_sb.return_value.table.return_value.select.return_value \
               .eq.return_value.order.return_value.execute.return_value.data = [
            context.get("seeded_message", {})
        ]
        context["response"] = client.get("/messages/inbox")

@then(parsers.parse("the response status should be {code:d}"))
def check_status(context, code):
    assert context["response"].status_code == code

@then("the message should contain my sender ID")
def check_sender_id(context):
    assert context["response"].json()["sender_id"] == FAKE_SENDER_ID

@then(parsers.parse("I should see at least {n:d} message in the response"))
def check_inbox_count(context, n):
    assert len(context["response"].json()) >= n


# ── Plain TDD unit tests ─────────────────────────────────────────────────

def test_send_message_missing_body_returns_422(client):
    resp = client.post("/messages/", json={"recipient_id": FAKE_RECIPIENT_ID})
    assert resp.status_code == 422

def test_send_message_missing_recipient_returns_422(client):
    resp = client.post("/messages/", json={"body": "Hello"})
    assert resp.status_code == 422





