import type { Application } from 'express';

export type ServerBinding = {
  host: '127.0.0.1' | '0.0.0.0';
  port: number;
};

function normalizeAddress(address: string): string {
  return address.startsWith('::ffff:') ? address.slice(7) : address;
}

/** Trust only a reverse proxy connected through this machine's loopback interface. */
export function trustLocalReverseProxy(address: string): boolean {
  const normalized = normalizeAddress(address);
  if (normalized === '::1') return true;
  const octets = normalized.split('.');
  return octets.length === 4
    && octets.every(octet => /^\d{1,3}$/.test(octet) && Number(octet) <= 255)
    && octets[0] === '127';
}

export function configureNetworkPolicy(app: Application): void {
  app.set('trust proxy', trustLocalReverseProxy);
}

export function getServerBinding(environment = process.env.NODE_ENV): ServerBinding {
  return {
    host: environment === 'production' ? '127.0.0.1' : '0.0.0.0',
    port: 3000,
  };
}
