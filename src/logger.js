// 操作日志模块 - 推送到Web前端
const listeners = new Set();

export function addLogListener(fn) {
  listeners.add(fn);
}

export function removeLogListener(fn) {
  listeners.delete(fn);
}

export function log(level, message, data = null) {
  const entry = {
    time: new Date().toISOString(),
    level,
    message,
    data,
  };
  console.log(`[${entry.time}] [${level}] ${message}`);
  for (const fn of listeners) {
    try { fn(entry); } catch {}
  }
  return entry;
}

export const info = (msg, data) => log('INFO', msg, data);
export const warn = (msg, data) => log('WARN', msg, data);
export const error = (msg, data) => log('ERROR', msg, data);
export const action = (msg, data) => log('ACTION', msg, data);
