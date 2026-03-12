const indicator = document.getElementById("status-indicator");
const statusText = document.getElementById("deployment-status");
const messageBox = document.getElementById("message-box");
const fetchBtn = document.getElementById("fetch-btn");
const versionEl = document.getElementById("app-version");
const envEl = document.getElementById("app-env");

async function checkHealth() {
  indicator.className = "status-indicator loading";
  statusText.textContent = "Checking deployment status…";
  try {
    const res = await fetch("/health");
    const data = await res.json();
    if (data.status === "ok") {
      indicator.className = "status-indicator ok";
      statusText.textContent = "Deployment is healthy and running.";
    } else {
      throw new Error("unexpected status");
    }
  } catch {
    indicator.className = "status-indicator error";
    statusText.textContent = "Could not reach backend.";
  }
}

async function fetchMessage() {
  fetchBtn.disabled = true;
  messageBox.className = "message-box";
  messageBox.textContent = "Fetching…";
  try {
    const res = await fetch("/api/message");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    messageBox.className = "message-box success";
    messageBox.textContent = data.message;

    if (data.version) versionEl.textContent = data.version;
    if (data.environment) envEl.textContent = data.environment;
  } catch (err) {
    messageBox.className = "message-box error";
    messageBox.textContent = `Error: ${err.message}`;
  } finally {
    fetchBtn.disabled = false;
  }
}

// Run health check on page load
checkHealth();
