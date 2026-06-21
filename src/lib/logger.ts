type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const isProd = import.meta.env.PROD;

// Champs à masquer
const SENSITIVE = ['password', 'token', 'secret', 'authorization', 'fcm_token', 'pin', 'otp', 'card', 'mot_de_passe'];

function sanitize(data: unknown, depth = 0): unknown {
  if (depth > 4 || data === null || data === undefined) return data;
  if (typeof data !== 'object') return data;
  const obj = data as Record<string, unknown>;
  const clean: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    if (SENSITIVE.some(s => key.toLowerCase().includes(s))) {
      clean[key] = '[REDACTED]';
    } else {
      clean[key] = typeof obj[key] === 'object' ? sanitize(obj[key], depth + 1) : obj[key];
    }
  }
  return clean;
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  return local.slice(0, 3) + '***@' + domain;
}

class Logger {
  private prefix = '[Nanei Admin]';

  private log(level: LogLevel, message: string, meta?: unknown) {
    const timestamp = new Date().toISOString();
    const safe = meta ? sanitize(meta) : undefined;
    const entry = { timestamp, level, message, ...(safe ? { meta: safe } : {}) };

    if (isProd) {
      // En production : seulement warn et error dans la console
      if (level === 'error') {
        console.error(JSON.stringify(entry));
        // TODO: envoyer vers Sentry/LogRocket si configuré
        // Sentry.captureMessage(message, { level, extra: safe });
      } else if (level === 'warn') {
        console.warn(JSON.stringify(entry));
      }
      // debug et info silencieux en production
    } else {
      // En développement : tout afficher avec couleurs
      const colors: Record<LogLevel, string> = {
        debug: 'color: #888',
        info: 'color: #2196F3',
        warn: 'color: #FF9800',
        error: 'color: #F44336; font-weight: bold',
      };
      console.log(
        `%c${this.prefix} [${level.toUpperCase()}] ${message}`,
        colors[level],
        safe ?? ''
      );
    }
  }

  debug(message: string, meta?: unknown) { this.log('debug', message, meta); }
  info(message: string, meta?: unknown)  { this.log('info', message, meta); }
  warn(message: string, meta?: unknown)  { this.log('warn', message, meta); }
  error(message: string, meta?: unknown) { this.log('error', message, meta); }

  // Helpers
  maskEmail = maskEmail;

  // Log une erreur API
  apiError(endpoint: string, status: number, message: string, meta?: unknown) {
    this.error(`API ${status} — ${endpoint}`, { endpoint, status, message, ...((meta as object) ?? {}) });
  }

  // Log une action utilisateur importante
  action(name: string, meta?: unknown) {
    this.info(`Action: ${name}`, meta);
  }
}

export const logger = new Logger();
export default logger;
