
FROM python:3.12-slim AS builder

WORKDIR /install

COPY app/requirements.txt .

RUN pip install --no-cache-dir --prefix=/install/deps -r requirements.txt

FROM python:3.12-slim

RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser

WORKDIR /app

COPY --from=builder /install/deps /usr/local

COPY app/ .

USER appuser

EXPOSE 5001

CMD ["gunicorn", "--bind", "0.0.0.0:5001", "--workers", "2", "--timeout", "60", "app:app"]
