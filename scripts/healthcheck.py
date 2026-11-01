"""Docker HEALTHCHECK probe for the Django container.

Sends a Host header from DJANGO_ALLOWED_HOSTS: probing as "127.0.0.1" would be rejected
by Django's host validation in production and mark a healthy container as unhealthy."""
import os
import sys
import urllib.request


def probe_host():
    for host in os.environ.get("DJANGO_ALLOWED_HOSTS", "localhost").split(","):
        # ".example.com" is a wildcard entry; "example.com" itself matches it
        host = host.strip().lstrip(".")
        if host and host != "*":
            return host
    return "localhost"


request = urllib.request.Request("http://127.0.0.1:8000/api/health/", headers={"Host": probe_host()})
try:
    with urllib.request.urlopen(request, timeout=4) as response:
        sys.exit(0 if response.status == 200 else 1)
except Exception:
    sys.exit(1)
