const rawBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const API_BASE_URL = rawBaseUrl.replace(/\/+$/, '');

export async function checkHealth() {
  const res = await fetch(`${API_BASE_URL}/health`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Health check failed with status ${res.status}`);
  }
  return res.json();
}

export async function sendChatMessage({ sessionId, message, systemPrompt, simulationHeader }) {
  const headers = {
    'Content-Type': 'application/json',
  };

  if (simulationHeader && simulationHeader.trim() !== '') {
    headers['X-Simulate-Failure'] = simulationHeader.trim();
  }

  const payload = {
    session_id: sessionId,
    message: message,
  };

  if (systemPrompt && systemPrompt.trim() !== '') {
    payload.system_prompt = systemPrompt.trim();
  }

  const res = await fetch(`${API_BASE_URL}/chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    let errorMessage = 'An error occurred';
    if (data && data.detail) {
      if (typeof data.detail === 'string') {
        errorMessage = data.detail;
      } else if (Array.isArray(data.detail)) {
        errorMessage = data.detail.map((d) => d.msg || JSON.stringify(d)).join(', ');
      } else {
        errorMessage = JSON.stringify(data.detail);
      }
    } else {
      errorMessage = `Server returned HTTP ${res.status}`;
    }
    const err = new Error(errorMessage);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

export async function getSessionMessages(sessionId) {
  const res = await fetch(`${API_BASE_URL}/sessions/${sessionId}/messages`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to fetch session history (${res.status})`);
  }
  return res.json();
}
