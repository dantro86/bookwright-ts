/**
 * Minimal OpenSSH `known_hosts` matcher for host-key pinning. Supports plain host patterns
 * (`host`, `[host]:port`, comma-separated lists). Hashed entries (`|1|...`) and markers such as
 * `@cert-authority` are not supported and never match, so verification fails closed.
 */
export function knownHostKeys(knownHosts: string, host: string, port: number): readonly string[] {
  const target = port === 22 ? host : `[${host}]:${port}`;
  return knownHosts
    .split('\n')
    .map((line) => line.trim())
    .filter(
      (line) =>
        line !== '' && !line.startsWith('#') && !line.startsWith('|') && !line.startsWith('@'),
    )
    .map((line) => line.split(/\s+/))
    .filter(([patterns]) => (patterns ?? '').split(',').includes(target))
    .map(([, , key]) => key ?? '')
    .filter((key) => key !== '');
}

/** True when the presented raw host key (SSH wire format) matches a pinned entry. */
export function isKnownHostKey(
  knownHosts: string,
  host: string,
  port: number,
  presented: Buffer,
): boolean {
  const encoded = presented.toString('base64');
  return knownHostKeys(knownHosts, host, port).includes(encoded);
}
