# Minimal SSH bastion: the only path from the host to MySQL. Built locally from a digest-pinned base.
FROM alpine:3.24@sha256:294b683cb724975bec92580e1e685676bd4b50bda910ddb8c51d4cabeaec77e6
RUN apk add --no-cache openssh-server \
  && adduser -D -s /bin/sh tunnel \
  && mkdir -p /etc/bookwright
COPY sshd_config /etc/ssh/sshd_config
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod 0755 /usr/local/bin/entrypoint.sh
EXPOSE 2222
HEALTHCHECK --interval=2s --timeout=2s --retries=30 CMD nc -z 127.0.0.1 2222 || exit 1
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
