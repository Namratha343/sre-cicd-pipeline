# sre-cicd-pipeline

CI/CD pipeline to automate build and deployment of applications through Kubernetes when code is pushed through the GitHub repo.

---

## Project Structure

```
sre-cicd-pipeline/
├── Dockerfile
└── app/
    ├── app.py
    ├── requirements.txt
    ├── static/
    │   ├── script.js
    │   └── style.css
    └── templates/
        └── index.html
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
