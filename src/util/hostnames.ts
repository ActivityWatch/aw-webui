export function preferKnownHostnames(hosts: string[]): string[] {
  const knownHosts = hosts.filter(host => host !== 'unknown');
  return knownHosts.length > 0
    ? [...knownHosts, ...hosts.filter(host => host === 'unknown')]
    : hosts;
}
