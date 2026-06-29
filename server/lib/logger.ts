import pc from 'picocolors';

const getPrefix = () => {
  const timestamp = new Date().toLocaleString('sv');
  return pc.dim(`[${timestamp}]`);
};

export const logger = {
  debug(...message: any[]) {
    console.log(getPrefix(), pc.blue('[DBG]'), ...message);
  },
  info(...message: any[]) {
    console.log(getPrefix(), pc.green('[INF]'), ...message);
  },
  warn(...message: any[]) {
    console.warn(getPrefix(), pc.yellow('[WRN]'), ...message);
  },
  error(message: string, error?: any) {
    console.error(getPrefix(), pc.red('[ERR]'), message, error || '');
  },
};
