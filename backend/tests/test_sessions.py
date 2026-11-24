import pytest


@pytest.mark.asyncio
async def test_session_history_roundtrip(client):
    session_id = "s-history-1"

    # Send 2 turns
    await client.post("/chat", json={"session_id": session_id, "message": "Turn 1"})
    await client.post("/chat", json={"session_id": session_id, "message": "Turn 2"})

    response = await client.get(f"/sessions/{session_id}/messages")
    assert response.status_code == 200
    data = response.json()

    assert data["session_id"] == session_id
    messages = data["messages"]
    assert len(messages) == 4

    # Turn 1
    assert messages[0]["role"] == "user"
    assert messages[0]["content"] == "Turn 1"
    assert messages[1]["role"] == "assistant"
    assert messages[1]["metadata"]["resolution_source"] == "LIVE_INFERENCE"

    # Turn 2
    assert messages[2]["role"] == "user"
    assert messages[2]["content"] == "Turn 2"
    assert messages[3]["role"] == "assistant"


@pytest.mark.asyncio
async def test_session_history_not_found(client):
    response = await client.get("/sessions/unknown-session-id/messages")
    assert response.status_code == 404
    data = response.json()
    assert data == {"detail": "session not found"}
