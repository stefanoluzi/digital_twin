#!/usr/bin/env bash
# Run as root on the Linux Docker host. No global flush or policy changes.
# Only the explicitly named LC1C bridge is affected. Safe to reapply.
set -euo pipefail
bridge=${1:?Usage: docker-egress-policy.sh lc1c-edge}
[[ "$bridge" =~ ^lc1c-[a-z0-9-]{1,10}$ ]] || { echo 'Invalid scoped bridge name' >&2; exit 1; }
[[ $EUID == 0 ]] || { echo 'Root required on Docker host' >&2; exit 1; }
for tool in iptables ip6tables; do
    command -v "$tool" >/dev/null
    "$tool" -w -N DOCKER-USER 2>/dev/null || "$tool" -w -S DOCKER-USER >/dev/null
    "$tool" -w -C FORWARD -j DOCKER-USER 2>/dev/null || "$tool" -w -I FORWARD 1 -j DOCKER-USER
    # Established replies to HTTP clients remain allowed; NEW outbound is denied.
    "$tool" -w -C DOCKER-USER -i "$bridge" ! -o "$bridge" -m conntrack ! --ctstate ESTABLISHED,RELATED -j DROP 2>/dev/null ||
        "$tool" -w -I DOCKER-USER 1 -i "$bridge" ! -o "$bridge" -m conntrack ! --ctstate ESTABLISHED,RELATED -j DROP
    # Also deny new connections to services on the Docker host itself.
    "$tool" -w -C INPUT -i "$bridge" -m conntrack ! --ctstate ESTABLISHED,RELATED -j DROP 2>/dev/null ||
        "$tool" -w -I INPUT 1 -i "$bridge" -m conntrack ! --ctstate ESTABLISHED,RELATED -j DROP
done
echo "Egress policy applied only to $bridge (IPv4 and IPv6)."
