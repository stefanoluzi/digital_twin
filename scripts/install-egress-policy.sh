#!/usr/bin/env bash
# Production default bridge names. Custom names require matching systemd instances.
set -euo pipefail
[[ $EUID == 0 ]] || { echo 'Run with sudo on the Linux Docker host' >&2; exit 1; }
root=$(cd "$(dirname "$0")/.." && pwd)
command -v iptables >/dev/null
command -v ip6tables >/dev/null
command -v systemctl >/dev/null
install -m 0755 "$root/scripts/docker-egress-policy.sh" /usr/local/sbin/lc1c-docker-egress-policy
install -m 0644 "$root/deploy/lc1c-egress@.service" /etc/systemd/system/lc1c-egress@.service
install -d /etc/systemd/system/docker.service.d
install -m 0644 "$root/deploy/docker-egress.conf" /etc/systemd/system/docker.service.d/lc1c-egress.conf
systemctl daemon-reload
systemctl enable --now lc1c-egress@lc1c-edge.service lc1c-egress@lc1c-front.service lc1c-egress@lc1c-runtime.service
echo 'Scoped firewall installed. Docker was not restarted. No existing rules were flushed.'
