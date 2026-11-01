FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_ROOT_USER_ACTION=ignore

WORKDIR /code
RUN groupadd --system app && useradd --system --gid app --no-create-home app

COPY requirements.txt requirements-dev.txt constraints.txt ./
RUN pip install -r requirements.txt -c constraints.txt
# Test tooling is only installed when building for development/CI
ARG INSTALL_DEV=false
RUN if [ "$INSTALL_DEV" = "true" ]; then pip install -r requirements-dev.txt -c constraints.txt; fi

COPY --chown=app:app . .
# collectstatic only reads settings; the throwaway key never reaches runtime
RUN DJANGO_SECRET_KEY=collectstatic-only python manage.py collectstatic --noinput

USER app
EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 CMD ["python", "scripts/healthcheck.py"]

# Only nginx can reach this port and it rewrites X-Forwarded-*, so trusting those headers is safe.
# --ws-max-size caps WebSocket frames well above the 2000-character message limit.
CMD ["sh", "-c", "exec uvicorn config.asgi:application --host 0.0.0.0 --port 8000 --workers ${WEB_CONCURRENCY:-2} --proxy-headers --forwarded-allow-ips='*' --ws-max-size 65536 --no-server-header"]
