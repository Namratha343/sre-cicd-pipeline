# sre-cicd-pipeline

CI/CD pipeline to automate build and deployment of applications through Kubernetes when code is pushed through the GitHub repo.

---

## Project Structure

```
sre-cicd-pipeline/
├── Dockerfile
├── Jenkinsfile
├── app/
│   ├── app.py
│   ├── requirements.txt
│   ├── static/
│   │   ├── script.js
│   │   └── style.css
│   └── templates/
│       └── index.html
└── k8s/
    ├── deployment.yaml
    └── service.yaml
```

---

## Running Locally

### Prerequisites
- Python 3.10+

### Steps

**1. Navigate to the app directory**
```bash
cd app
```

**2. Create and activate a virtual environment**
```bash
python3 -m venv venv
source venv/bin/activate
```

**3. Install dependencies**
```bash
pip install -r requirements.txt
```

**4. Start the app**
```bash
python app.py
```

The app will be available at **http://localhost:5001**

**5. To stop the app**

Press `Ctrl+C`, then deactivate the virtual environment:
```bash
deactivate
```

### Override the port (optional)
```bash
PORT=8080 python app.py
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Serves the frontend UI |
| GET | `/health` | Returns `{"status": "ok"}` |
| GET | `/api/message` | Returns a message from the backend |
| GET | `/metrics` | Returns app uptime and version info |

---

## Running with Docker

**1. Build the image**
```bash
docker build -t cicd-demo:latest .
```

**2. Run the container**
```bash
docker run -p 5001:5000 -e APP_ENV=production -e APP_VERSION=1.0.0 cicd-demo:latest
```

The app will be available at **http://localhost:5001**

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `5001` | Port the app listens on |
| `APP_VERSION` | `1.0.0` | App version displayed in the UI |
| `APP_ENV` | `development` | Environment name displayed in the UI |

---

## CI/CD Pipeline (Jenkins)

### Pipeline Overview

```
GitHub Push
    │
    ▼
Git Checkout  →  SonarQube Analysis  →  Quality Gate
    │
    ▼
Trivy FS Scan (source files)
    │
    ▼
Docker Login  →  Build Docker Image
    │
    ▼
Trivy Image Scan (built image)
    │
    ▼
Push to Docker Hub  →  Deploy to Kubernetes  →  Email Notification
```

### Jenkins Setup on Contabo Server

#### 1. Required Jenkins Plugins

Install these from **Manage Jenkins → Plugins**:

| Plugin | Purpose |
|--------|---------|
| Git Plugin | GitHub checkout |
| GitHub Plugin | `githubPush()` webhook trigger |
| SonarQube Scanner | Code quality analysis |
| Docker Pipeline | Docker build/push inside pipeline |
| Kubernetes CLI Plugin | `kubectl` via kubeconfig credential |
| Email Extension Plugin | Success/failure email notifications |

#### 2. Jenkins Credentials to Create

Go to **Manage Jenkins → Credentials → Global** and add:

| ID | Type | What to put |
|----|------|-------------|
| `git-cred` | Username + Password | GitHub username + Personal Access Token |
| `docker-cred` | Username + Password | Docker Hub username + password |
| `kubeconfig` | Secret file | Upload your `~/.kube/config` from the Contabo server |

#### 3. Configure SonarQube

1. In SonarQube, create a project named `sre-cicd-pipeline` and copy the token.
2. In Jenkins → **Manage Jenkins → System**, add a **SonarQube server**:
   - Name: `sonarqube`
   - URL: `http://<contabo-ip>:9000`
   - Token: (add as a Jenkins secret text credential and select it)
3. In Jenkins → **Global Tool Configuration**, add a **SonarQube Scanner** installation named `sonar-scanner`.

#### 4. Install Trivy on the Jenkins Agent

```bash
sudo apt-get install -y wget apt-transport-https gnupg
wget -qO - https://aquasecurity.github.io/trivy-repo/deb/public.key | sudo apt-key add -
echo "deb https://aquasecurity.github.io/trivy-repo/deb $(lsb_release -sc) main" \
    | sudo tee /etc/apt/sources.list.d/trivy.list
sudo apt-get update && sudo apt-get install -y trivy
```

#### 5. Create the Jenkins Pipeline Job

1. **New Item** → **Pipeline** → name it `sre-cicd-pipeline`
2. Under **Build Triggers**, check **GitHub hook trigger for GITScm polling**
3. Under **Pipeline**, select **Pipeline script from SCM**:
   - SCM: Git
   - Repository URL: `https://github.com/Namratha343/sre-cicd-pipeline.git`
   - Credentials: `git-cred`
   - Branch: `*/main`
   - Script Path: `Jenkinsfile`
4. Save.

#### 6. Configure GitHub Webhook

In your GitHub repo → **Settings → Webhooks → Add webhook**:

- Payload URL: `http://<contabo-ip>:8080/github-webhook/`
- Content type: `application/json`
- Trigger: **Just the push event**

#### 7. Kubernetes Access

The pipeline uses the `kubeconfig` credential (secret file). Make sure:
- The kubeconfig file has the correct server IP of your Contabo K8s cluster.
- The context points to the right cluster.

Verify connectivity from Jenkins with:
```bash
kubectl get nodes --kubeconfig=/path/to/your/kubeconfig
```

#### 8. App Access After Deployment

Once deployed, the app is available at:
```
http://<contabo-server-ip>:30080
```
(NodePort 30080 as defined in `k8s/service.yaml`)
