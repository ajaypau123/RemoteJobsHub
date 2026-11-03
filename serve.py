"""Lightweight local development server for the JobsForIndia dashboard.

Usage:
    python serve.py
    python serve.py --port 8080
"""

import argparse
import http.server
import os
import socketserver
import sys

DEFAULT_PORT = 8000
WORKSPACE_DIR = os.path.dirname(os.path.abspath(__file__))
DASHBOARD_DIR = os.path.join(WORKSPACE_DIR, "dashboard")
OUTPUT_DIR = os.path.join(WORKSPACE_DIR, "output")


class DashboardHandler(http.server.SimpleHTTPRequestHandler):
    """Custom HTTP handler serving dashboard and output files seamlessly."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DASHBOARD_DIR, **kwargs)

    def do_GET(self):
        # Serve jobs_latest.json from the output folder
        if self.path in ("/output/jobs_latest.json", "/jobs_latest.json"):
            json_file = os.path.join(OUTPUT_DIR, "jobs_latest.json")
            if os.path.exists(json_file):
                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                with open(json_file, "rb") as f:
                    self.wfile.write(f.read())
                return
            else:
                self.send_error(404, "jobs_latest.json not found. Run 'python -m aggregator.main --india' first.")
                return

        return super().do_GET()


def main():
    parser = argparse.ArgumentParser(description="Start JobsForIndia Dashboard local server")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help="Port to bind (default: 8000)")
    args = parser.parse_args()

    # Fix Windows console encoding
    if hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass

    port = args.port
    print("=" * 60)
    print("  JobsForIndia -- Job Search Dashboard")
    print("=" * 60)
    print(f"  Local URL : http://localhost:{port}")
    print(f"  Dashboard : {DASHBOARD_DIR}")
    print("  Exit      : Press Ctrl+C to stop")
    print("=" * 60)
    print()

    socketserver.TCPServer.allow_reuse_address = True
    try:
        with socketserver.TCPServer(("", port), DashboardHandler) as httpd:
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")


if __name__ == "__main__":
    main()

