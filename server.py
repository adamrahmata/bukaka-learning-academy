import json
import random
import socket
import string
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

sessions = {}


def lan_address():
    probe = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        probe.connect(("8.8.8.8", 80))
        return probe.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        probe.close()


def token():
    return "".join(random.choice(string.digits) for _ in range(6))


class Handler(SimpleHTTPRequestHandler):
    def json_response(self, data, status=200):
        payload = json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def read_json(self):
        length = int(self.headers.get("Content-Length", 0))
        return json.loads(self.rfile.read(length) or b"{}")

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/api/session":
            code = urlparse(self.path).query.removeprefix("token=")
            session = sessions.get(code)
            if not session:
                return self.json_response({"error": "Token tidak ditemukan."}, 404)
            return self.json_response(session)
        return super().do_GET()

    def do_POST(self):
        path = urlparse(self.path).path
        data = self.read_json()
        if path == "/api/session/create":
            code = token()
            while code in sessions:
                code = token()
            sessions[code] = {
                "token": code,
                "title": data.get("title", "Sesi Kuis SMK3"),
                "criterionId": data.get("criterionId", 1),
                "host": data.get("host", "Learning Partner"),
                "status": "waiting",
                "participants": [],
                "createdAt": time.time(),
                "joinUrl": f"http://{lan_address()}:4173/?join={code}",
            }
            return self.json_response(sessions[code])
        if path == "/api/session/join":
            session = sessions.get(str(data.get("token", "")))
            if not session:
                return self.json_response({"error": "Token tidak ditemukan atau sesi sudah berakhir."}, 404)
            participant = {"id": token(), "name": data.get("name", "Peserta"), "avatar": data.get("avatar", "🦺"), "score": 0, "answered": False}
            session["participants"] = [p for p in session["participants"] if p["name"] != participant["name"]]
            session["participants"].append(participant)
            return self.json_response({"session": session, "participant": participant})
        if path == "/api/session/start":
            session = sessions.get(str(data.get("token", "")))
            if not session:
                return self.json_response({"error": "Sesi tidak ditemukan."}, 404)
            session["status"] = "live"
            session["startedAt"] = time.time()
            return self.json_response(session)
        if path == "/api/session/answer":
            session = sessions.get(str(data.get("token", "")))
            if not session:
                return self.json_response({"error": "Sesi tidak ditemukan."}, 404)
            participant = next((p for p in session["participants"] if p["id"] == data.get("participantId")), None)
            if not participant or participant["answered"]:
                return self.json_response({"error": "Jawaban tidak dapat diterima."}, 400)
            participant["answered"] = True
            participant["correct"] = bool(data.get("correct"))
            participant["score"] += int(data.get("points", 0))
            return self.json_response(session)
        return self.json_response({"error": "Endpoint tidak ditemukan."}, 404)


if __name__ == "__main__":
    print("Bukaka LMS LAN server: http://0.0.0.0:4173")
    ThreadingHTTPServer(("0.0.0.0", 4173), Handler).serve_forever()
