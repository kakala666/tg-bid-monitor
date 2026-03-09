// 入口文件
import 'dotenv/config';
import * as tg from './telegram.js';
import { startWebServer, loadConfig } from './web/server.js';
import * as logger from './logger.js';

async function main() {
  const apiId = process.env.API_ID;
  const apiHash = process.env.API_HASH;
  const phone = process.env.PHONE;
  const port = Number(process.env.WEB_PORT) || 3000;

  if (!apiId || !apiHash || !phone) {
    logger.error('请在 .env 文件中配置 API_ID, API_HASH, PHONE');
    process.exit(1);
  }

  // 1. 登录Telegram
  logger.info('正在连接Telegram...');
  await tg.initClient(apiId, apiHash, phone);

  // 2. 解析Bot
  const config = loadConfig();
  if (!config.botUsername || config.botUsername.includes('替换')) {
    logger.error('请在 config.json 中配置 botUsername');
    process.exit(1);
  }
  await tg.resolveBot(config.botUsername);

  // 3. 启动Web控制台
  startWebServer(port);

  logger.info('系统就绪。打开控制台后点击"首次导航"开始操作Bot');
}

main().catch((err) => {
  logger.error('启动失败', err.message);
  console.error(err);
  process.exit(1);
});
