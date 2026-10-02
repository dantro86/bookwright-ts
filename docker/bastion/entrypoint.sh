#!/bin/sh
set -eu
# A fresh host key per stand: clients must pin it through known_hosts (see scripts/local-stand.sh).
ssh-keygen -q -t ed25519 -N '' -f /etc/ssh/ssh_host_ed25519_key
if [ -n "${BASTION_AUTHORIZED_KEY:-}" ]; then
  printf '%s\n' "${BASTION_AUTHORIZED_KEY}" > /etc/bookwright/authorized_keys
  chmod 0644 /etc/bookwright/authorized_keys
fi
if [ -n "${BASTION_PASSWORD:-}" ]; then
  echo "tunnel:${BASTION_PASSWORD}" | chpasswd
  sed -i 's/^PasswordAuthentication no/PasswordAuthentication yes/' /etc/ssh/sshd_config
else
  passwd -l tunnel >/dev/null 2>&1 || true
  # Locked accounts are rejected even for key auth on some builds; unlock with an unusable hash.
  sed -i 's/^tunnel:!/tunnel:*/' /etc/shadow
fi
exec /usr/sbin/sshd -D -e
