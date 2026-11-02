/**
 * Сервер бота ВКонтакте для рассылки важных сообщений старосты и заместителя старосты
 * Запуск: VK_GROUP_TOKEN=ваш_токен PORT=3001 node bot_server/bot.js
 */
import http from 'http';
import https from 'https';

const VK_GROUP_TOKEN = process.env.VK_GROUP_TOKEN || '';
const PORT = process.env.PORT || 3001;

function sendVkMessage(peerId, message) {
  return new Promise((resolve, reject) => {
    if (!VK_GROUP_TOKEN) {
      return resolve({ simulated: true });
    }
    const randomId = Math.floor(Math.random() * 1e9);
    const params = new URLSearchParams({
      peer_id: String(peerId),
      message,
      random_id: String(randomId),
      access_token: VK_GROUP_TOKEN,
      v: '5.199',
    });

    const req = https.request(
      `https://api.vk.com/method/messages.send?${params.toString()}`,
      { method: 'POST' },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => resolve(JSON.parse(data)));
      }
    );
    req.on('error', reject);
    req.end();
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  if (req.method === 'POST' && req.url === '/api/broadcast') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', async () => {
      try {
        const { title, text, senderName, senderRoleLabel, peerIds = [] } = JSON.parse(body);
        const formatted = `🤖 [Важное сообщение группы]\n📌 ${title}\n\n${text}\n\n👤 Отправитель: ${senderName} (${senderRoleLabel})`;
        for (const peerId of peerIds) {
          await sendVkMessage(peerId, formatted);
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, sent: peerIds.length }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    });
    return;
  }

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'Starosta VK Bot API Running' }));
});

server.listen(PORT, () => {
  console.log(`Starosta VK Bot Server running on port ${PORT}`);
});
