import os
import time
from flask import Flask, jsonify, render_template

app = Flask(__name__)

START_TIME = time.time()


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/health")
def health():
    return jsonify({"status": "ok"})


@app.route("/api/message")
def api_message():
    return jsonify({
        "message": "Hello from the backend deployed via CI/CD",
        "version": os.getenv("APP_VERSION", "1.0.0"),
        "environment": os.getenv("APP_ENV", "development"),
    })


@app.route("/metrics")
def metrics():
    uptime_seconds = int(time.time() - START_TIME)
    return jsonify({
        "uptime_seconds": uptime_seconds,
        "status": "running",
        "version": os.getenv("APP_VERSION", "1.0.0"),
    })


if __name__ == "__main__":
    port = int(os.getenv("PORT", 5001))
    app.run(host="0.0.0.0", port=port, debug=False)
