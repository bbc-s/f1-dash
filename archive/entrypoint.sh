#!/bin/sh
set -eu

/archive &
ARCHIVE_PID=$!

AUTO_RECORD="${ARCHIVE_AUTO_RECORD:-true}"
case "$(echo "$AUTO_RECORD" | tr '[:upper:]' '[:lower:]')" in
  "0"|"false"|"no")
    AUTO_ENABLED="false"
    ;;
  *)
    AUTO_ENABLED="true"
    ;;
esac

if [ "$AUTO_ENABLED" = "true" ]; then
  ATTEMPTS=0
  until wget -q -O - "http://127.0.0.1:80/api/health" >/dev/null 2>&1; do
    ATTEMPTS=$((ATTEMPTS + 1))
    if [ "$ATTEMPTS" -ge 30 ]; then
      break
    fi
    sleep 1
  done

  wget -q -O - --post-data='{}' --header='Content-Type: application/json' "http://127.0.0.1:80/api/archive/start" >/dev/null 2>&1 || true
fi

wait "$ARCHIVE_PID"
