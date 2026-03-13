# CI/CD Pipeline with Jenkins, Docker, and Kubernetes

A production-ready CI/CD pipeline that automates the build, security scanning, and deployment of a Python Flask application to a Kubernetes cluster using Jenkins, Docker, SonarQube, Trivy, and Prometheus + Grafana for monitoring.

---

## Table of Contents

1. [Overview](#overview)
2. [Project Structure](#project-structure)
3. [Application](#application)
4. [Pipeline Architecture](#pipeline-architecture)
5. [Jenkins Setup](#jenkins-setup)
6. [Kubernetes Setup](#kubernetes-setup)
7. [Monitoring with Prometheus & Grafana](#monitoring-with-prometheus--grafana)
8. [Running Locally](#running-locally)
9. [Security Practices](#security-practices)

---

## Overview

This project implements a fully automated CI/CD pipeline that satisfies the following requirements:

- Whenever a commit is pushed to the GitHub repository, Jenkins automatically triggers a build
- Upon a successful build, Jenkins deploys the artifact to a Kubernetes cluster on a Contabo server
- The pipeline is implemented using Groovy scripting (Jenkinsfile) for flexibility and extensibility
- Security scanning is integrated at both source and image level using Trivy
- Code quality is enforced using SonarQube with a Quality Gate
- The system is monitored using Prometheus and Grafana

application_url = http://207.180.223.198:30080/
---

## Project Structure

```
sre-cicd-pipeline/
├── Dockerfile               # Multi-stage Docker build
├── Jenkinsfile              # Groovy pipeline definition
├── app/
│   ├── app.py               # Flask backend
│   ├── requirements.txt     # Python dependencies
│   ├── static/
│   │   ├── script.js        # Frontend API call
│   │   └── style.css        # Styling
│   └── templates/
│       └── index.html       # Frontend UI
└── k8s/
    ├── namespace.yaml       # Kubernetes namespace: sre-cicd
    ├── deployment.yaml      # App deployment (2 replicas)
    └── service.yaml         # NodePort service on port 30080
```

---

## Application

A lightweight Python Flask app with the following endpoints:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Serves the frontend UI |
| GET | `/health` | Returns `{"status": "ok"}` — used by K8s probes |
| GET | `/api/message` | Returns a message from the backend |
| GET | `/metrics` | Returns app uptime and version |

The frontend calls `/api/message` and displays the response, demonstrating the full pipeline flow from code to running container.

---

## Pipeline Architecture

### Flow

```
Developer pushes code to GitHub
            │
            ▼
   GitHub Webhook triggers Jenkins
            │
            ▼
┌─────────────────────────────────────────┐
│              JENKINS PIPELINE           │
│                                         │
│  1. Git Checkout                        │
│  2. SonarQube Analysis                  │
│  3. Quality Gate (pass/fail)            │
│  4. Trivy FS Scan  ← source files       │
│  5. Docker Login                        │
│  6. Build & Push Image (linux/amd64)    │
│  7. Trivy Image Scan ← built image      │
│  8. Deploy to Kubernetes                │
│                                         │
└─────────────────────────────────────────┘
            │
            ▼
   Kubernetes Cluster (Contabo)
   Namespace: sre-cicd
   App available at http://207.180.223.198:30080/
            │
            ▼
   Slack Notification (success/failure)
```

### Pipeline Stages Explained

| Stage | What it does |
|-------|-------------|
| **Git Checkout** | Pulls the latest code from the `main` branch |
| **SonarQube Analysis** | Scans Python source code for bugs, vulnerabilities, and code smells |
| **Quality Gate** | Fails the pipeline if SonarQube quality gate is red |
| **Trivy FS Scan** | Scans source files and dependencies for known CVEs before building |
| **Docker Login** | Authenticates to Docker Hub using stored Jenkins credentials |
| **Build & Push Docker Image** | Builds a `linux/amd64` image using `docker buildx` and pushes to Docker Hub with the git SHA as the tag |
| **Trivy Image Scan** | Scans the pushed Docker image for HIGH/CRITICAL vulnerabilities |
| **Deploy to Kubernetes** | Applies namespace, service, and deployment manifests; waits for rollout to complete |

---

## Jenkins Setup

### Prerequisites

- Jenkins running on the server (port `8080`)
- Docker installed on the Jenkins agent
- `kubectl` installed on the Jenkins agent

### 1. Required Plugins

Install from **Manage Jenkins → Plugins**:

| Plugin | Purpose |
|--------|---------|
| Git Plugin | GitHub checkout |
| GitHub Plugin | `githubPush()` webhook trigger |
| SonarQube Scanner | Code quality analysis |
| Docker Pipeline | Docker build/push inside pipeline |
| Kubernetes CLI Plugin | `kubectl` via kubeconfig credential |
| Slack Notification Plugin | Pipeline success/failure alerts |

### 2. Credentials to Configure

Go to **Manage Jenkins → Credentials → Global**:

| Credential ID | Type | Value |
|---------------|------|-------|
| `git-cred` | Username + Password | GitHub username + Personal Access Token |
| `docker-cred` | Username + Password | Docker Hub username + password |
| `kubeconfig` | Secret file | Upload `~/.kube/config` from the Contabo server |

### 3. SonarQube Configuration

1. In SonarQube, create a project named `sre-cicd-pipeline` and generate a token.
2. In Jenkins → **Manage Jenkins → System**, add a SonarQube server:
   - Name: `sonarqube`
   - URL: `http://<server-ip>:9000`
   - Token: add as a Jenkins secret text credential
3. In **Global Tool Configuration**, add a SonarQube Scanner named `sonar-scanner`.
4. In SonarQube → **Administration → Configuration → Webhooks**, add a webhook so SonarQube can notify Jenkins when the analysis is complete (required for `waitForQualityGate` to work):
   - Name: `jenkins`
   - URL: `http://<jenkins-url>/sonarqube-webhook/`
   - Click **Create**

   > Without this webhook, the pipeline will hang indefinitely at the Quality Gate stage.

### 4. Create the Pipeline Job

1. **New Item → Pipeline** → name it `sre-cicd-pipeline`
2. **Build Triggers** → check **GitHub hook trigger for GITScm polling**
3. **Pipeline → Pipeline script from SCM**:
   - SCM: Git
   - Repository URL: `https://github.com/Namratha343/sre-cicd-pipeline.git`
   - Credentials: `git-cred`
   - Branch: `*/main`
   - Script Path: `Jenkinsfile`
4. Save.

### 5. GitHub Webhook

In GitHub repo → **Settings → Webhooks → Add webhook**:

- Payload URL: `http://<server-ip>:8080/github-webhook/`
- Content type: `application/json`
- Trigger: **Just the push event**

---

## Kubernetes Setup

### Namespace

All resources are deployed into the `sre-cicd` namespace, created automatically by the pipeline via `k8s/namespace.yaml`.

### Deployment

- **2 replicas** for high availability
- **Liveness probe** on `/health` — restarts unhealthy pods
- **Readiness probe** on `/health` — removes pod from service until ready
- **Resource limits** — CPU: 250m, Memory: 256Mi

### Service

- Type: **NodePort**
- App accessible at: `http://207.180.223.198:30080`

### Verify Deployment

```bash
kubectl get pods -n sre-cicd
kubectl get svc -n sre-cicd
kubectl logs -l app=sre-cicd-pipeline -n sre-cicd
```

---

## Monitoring with Prometheus & Grafana

The Contabo server runs Prometheus and Grafana to monitor the health and performance of the CI/CD pipeline and the deployed application.

### What is Monitored

| Metric | Source |
|--------|--------|
| Pod health and restarts | Kubernetes node metrics |
| CPU and memory usage | Container resource metrics |
| HTTP request rates | Application `/metrics` endpoint |
| App uptime | Application `/metrics` endpoint |
| Jenkins build status | Jenkins Prometheus plugin |

### Accessing the Dashboards

| Tool | URL |
|------|-----|
| Prometheus | `http://<server-ip>:9090` |
| Grafana | `http://207.180.223.198:31551/d/sre-cicd-dashboard-2/sre-ci-cd-pipeline-e28094-kubernetes-monitoring?orgId=1&from=now-1h&to=now&timezone=browser&refresh=30s` |

---

## Running Locally

### Prerequisites
- Python 3.10+

### Steps

```bash
# 1. Navigate to the app directory
cd app

# 2. Create and activate a virtual environment
python3 -m venv venv
source venv/bin/activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Run the app
python app.py
```

App available at **http://localhost:5001**

### Run with Docker

```bash
# Build
docker build -t sre-cicd-pipeline:latest .

# Run
docker run -p 5001:5001 sre-cicd-pipeline:latest
```

---

## Security Practices

| Practice | Implementation |
|----------|---------------|
| Source code scanning | Trivy FS scan before Docker build |
| Image vulnerability scanning | Trivy image scan after Docker build |
| Code quality gate | SonarQube blocks pipeline if quality gate fails |
| No hardcoded secrets | All credentials stored in Jenkins credential store |
| Non-root container | Docker image runs as `appuser` (non-root) |
| Least privilege | Kubernetes resource limits enforced on all pods |
| Immutable image tags | Git SHA used as image tag — every build is uniquely traceable |
