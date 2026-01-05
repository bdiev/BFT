#!/usr/bin/env node
/**
 * Скрипт для управления правами администратора через терминал
 * Использование:
 *   node manage-admin.js op <username>    - дать права админа
 *   node manage-admin.js deop <username>  - забрать права админа
 */

const http = require('http');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';
const SECRET = process.env.INTERNAL_SECRET || process.env.JWT_SECRET || 'your-secret-key-change-in-production';

const command = process.argv[2];
const username = process.argv[3];

if (!command || !username) {
  console.log('❌ Использование:');
  console.log('   node manage-admin.js op <username>    - дать права администратора');
  console.log('   node manage-admin.js deop <username>  - забрать права администратора');
  process.exit(1);
}

function makeRequest(endpoint, data) {
  const postData = JSON.stringify(data);
  
  const options = {
    hostname: HOST,
    port: PORT,
    path: endpoint,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new Error(parsed.error || `HTTP ${res.statusCode}`));
          }
        } catch (e) {
          reject(new Error('Ошибка парсинга ответа'));
        }
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    req.write(postData);
    req.end();
  });
}

async function main() {
  try {
    let result;
    
    if (command === 'op') {
      result = await makeRequest('/api/internal/admin/grant', { 
        username, 
        secret: SECRET 
      });
      console.log(`✅ ${result.message}`);
      console.log(`   Пользователь: ${result.username}`);
      console.log(`   ID: ${result.userId}`);
      console.log(`   🔔 WebSocket уведомление отправлено`);
    } else if (command === 'deop') {
      result = await makeRequest('/api/internal/admin/revoke', { 
        username, 
        secret: SECRET 
      });
      console.log(`✅ ${result.message}`);
      console.log(`   Пользователь: ${result.username}`);
      console.log(`   ID: ${result.userId}`);
      console.log(`   🔔 WebSocket уведомление отправлено`);
    } else {
      console.log(`❌ Неизвестная команда: "${command}"`);
      console.log('   Доступные команды: op, deop');
      process.exit(1);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    console.error('   Убедись что сервер запущен на', `${HOST}:${PORT}`);
    process.exit(1);
  }
}

main();
