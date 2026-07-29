#!/usr/bin/env python3
import sys
import json
import ssl
import urllib.request
import urllib.error

NOTIFY_URL = "https://YOUR_JAVA_HOST:8443/api/perforce/notify"
TRIGGER_SECRET = "TRIGGER_SECRET_PLACEHOLDER"
TIMEOUT_SECONDS = 3


def main():
    try:
        if len(sys.argv) < 3:
            return 0

        event_type = sys.argv[1]
        entity_id = sys.argv[2]

        payload = json.dumps({
            "eventType": event_type,
            "entityId": entity_id,
        }).encode("utf-8")

        req = urllib.request.Request(
            NOTIFY_URL,
            data=payload,
            headers={
                "Content-Type": "application/json",
                "X-Trigger-Secret": TRIGGER_SECRET,
            },
            method="POST",
        )

        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE

        urllib.request.urlopen(req, timeout=TIMEOUT_SECONDS, context=ctx)

    except Exception:
        pass

    return 0


if __name__ == "__main__":
    sys.exit(main())
