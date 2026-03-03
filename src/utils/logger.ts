import pc from 'picocolors';

/** Structured logger with coloured output. */
export const logger = {
  info: (msg: string): void => {
    console.log(pc.blue('ℹ') + ' ' + msg);
  },
  success: (msg: string): void => {
    console.log(pc.green('✓') + ' ' + msg);
  },
  warn: (msg: string): void => {
    console.warn(pc.yellow('⚠') + ' ' + msg);
  },
  error: (msg: string): void => {
    console.error(pc.red('✗') + ' ' + msg);
  },
  step: (msg: string): void => {
    console.log(pc.dim('  →') + ' ' + msg);
  },
} as const;
