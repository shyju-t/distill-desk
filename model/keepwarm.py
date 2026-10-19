"""Optional foreground ping every 20 minutes; stop with Ctrl-C."""
import time
from datetime import datetime, timezone

from client import complete

if __name__ == "__main__":
    while True:
        started = time.perf_counter()
        try:
            result = complete([{"role": "user", "content": "What does the Free plan include?"}])
            print(datetime.now(timezone.utc).isoformat(), "answered", result.model,
                  f"{time.perf_counter() - started:.2f}s", flush=True)
        except Exception as exc:
            # Do not print response bodies or credentials.
            print(datetime.now(timezone.utc).isoformat(), type(exc).__name__, flush=True)
        time.sleep(20 * 60)
