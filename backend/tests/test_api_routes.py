from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_health_check():
    with TestClient(app) as client:
        response = client.get("/api/health")
        assert response.status_code == 200
        assert response.json() == {"status": "ok", "version": "2.0.0"}

def test_evaluate_missing_draft():
    with TestClient(app) as client:
        response = client.post("/api/evaluate", data={"rubric_text": "Sample Rubric"})
        assert response.status_code == 422
        assert "MISSING_DRAFT" in response.text

def test_evaluate_missing_rubric():
    with TestClient(app) as client:
        response = client.post("/api/evaluate", data={"draft_text": "Sample Draft " * 20})
        assert response.status_code == 422
        assert "MISSING_RUBRIC" in response.text

def test_evaluate_short_draft():
    with TestClient(app) as client:
        response = client.post("/api/evaluate", data={"draft_text": "Too short", "rubric_text": "Valid rubric"})
        assert response.status_code == 422
        assert "DRAFT_TOO_SHORT" in response.text

def test_get_job_status_not_found():
    with TestClient(app) as client:
        response = client.get("/api/jobs/invalid-job-id/status")
        assert response.status_code == 404
        assert "not found" in response.text

def test_rate_limit():
    with TestClient(app) as client:
        # slowapi limit is 5/minute. Let's do 6 requests.
        responses = []
        for _ in range(6):
            responses.append(client.post("/api/evaluate", data={"draft_text": "Sample Draft " * 20, "rubric_text": "Sample Rubric"}))
        
        # The 6th request should be 429 Too Many Requests
        assert responses[-1].status_code == 429
        assert "Rate limit exceeded" in responses[-1].text or "429" in str(responses[-1].status_code)

