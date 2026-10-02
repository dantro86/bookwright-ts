# Minimal SSH bastion: the only path from the host to MySQL. Built locally from a digest-pinned base.
FROM alpine:3.22@sha256:5291449c3df73caf6ed85e649dec1b9e818b39a5d8c871e97afc13e9cd5e8fa8
RUN apk add --no-cache openssh-server \
  && adduser -D -s /bin/sh tunnel \
  && mkdir -p /etc/bookwright
COPY sshd_config /etc/ssh/sshd_config
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod 0755 /usr/local/bin/entrypoint.sh
EXPOSE 2222
HEALTHCHECK --interval=2s --timeout=2s --retries=30 CMD nc -z 127.0.0.1 2222 || exit 1
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
