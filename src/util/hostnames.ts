export function preferKnownHostnames(hosts: string[]): string[] {
  const knownHosts = hosts.filter(host => host !== 'unknown');
  return knownHosts.length > 0
    ? [...knownHosts, ...hosts.filter(host => host === 'unknown')]
    : hosts;
}

export function knownHostnames(hosts: string[]): string[] {
  return hosts.filter(host => Boolean(host) && host !== 'unknown');
}

export function selectSoleKnownHostname(hosts: string[]): string | undefined {
  const known = knownHostnames(hosts);
  return known.length === 1 ? known[0] : undefined;
}

export type CategoryBuilderHostnameEmptyKind = 'no-hosts' | 'hostname-unselected' | null;

export function categoryBuilderHostnameEmptyKind(
  hosts: string[],
  hostname?: string | null
): CategoryBuilderHostnameEmptyKind {
  if (hostname) {
    return null;
  }
  return hosts.filter(Boolean).length === 0 ? 'no-hosts' : 'hostname-unselected';
}
