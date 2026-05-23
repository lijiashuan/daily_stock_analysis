import requests
import json

base_url = "https://daily-stock-analysis-9i5j.onrender.com"

print("=" * 60)
print("Checking Render Deployment Status")
print("=" * 60)

# 1. Check health
print("\n1. Health Check:")
try:
    r = requests.get(f"{base_url}/api/health", timeout=10)
    print(f"   Status: {r.status_code}")
    print(f"   Response: {r.json()}")
except Exception as e:
    print(f"   Error: {e}")

# 2. Check chat sessions API
print("\n2. Chat Sessions API:")
try:
    r = requests.get(f"{base_url}/api/v1/agent/chat/sessions?limit=10", timeout=10)
    print(f"   Status: {r.status_code}")
    if r.status_code == 200:
        data = r.json()
        sessions = data.get('sessions', [])
        print(f"   Sessions count: {len(sessions)}")
        if sessions:
            for s in sessions[:3]:
                print(f"   - {s['session_id']}: {s['title']}")
        else:
            print("   No sessions returned")
    else:
        print(f"   Error: {r.text}")
except Exception as e:
    print(f"   Error: {e}")

# 3. Check database directly via API
print("\n3. Database Check (via API):")
try:
    r = requests.get(f"{base_url}/api/health", timeout=10)
    health = r.json()
    print(f"   Health: {health}")
except Exception as e:
    print(f"   Error: {e}")

print("\n" + "=" * 60)
