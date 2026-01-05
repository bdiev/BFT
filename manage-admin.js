#!/usr/bin/env node
/**
 * Скрипт для управления правами администратора через терминал
 * Использование:
 *   node manage-admin.js op <username>    - дать права админа
 *   node manage-admin.js deop <username>  - забрать права админа
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'database.db');
const command = process.argv[2];
const username = process.argv[3];

if (!command || !username) {
  console.log('❌ Использование:');
  console.log('   node manage-admin.js op <username>    - дать права администратора');
  console.log('   node manage-admin.js deop <username>  - забрать права администратора');
  process.exit(1);
}

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('❌ Ошибка подключения к БД:', err.message);
    process.exit(1);
  }
});

if (command === 'op') {
  // Дать права администратора
  db.get('SELECT id, username, is_admin FROM users WHERE username = ?', [username], (err, user) => {
    if (err) {
      console.log('❌ Ошибка БД:', err.message);
      db.close();
      process.exit(1);
    }
    if (!user) {
      console.log(`❌ Пользователь "${username}" не найден`);
      db.close();
      process.exit(1);
    }
    if (user.is_admin) {
      console.log(`⚠️  Пользователь "${username}" уже является администратором`);
      db.close();
      process.exit(0);
    }

    db.run('UPDATE users SET is_admin = 1 WHERE id = ?', [user.id], function(err) {
      if (err) {
        console.log('❌ Ошибка обновления:', err.message);
        db.close();
        process.exit(1);
      }
      console.log(`✅ Пользователь "${username}" получил права администратора`);
      console.log(`   ID: ${user.id}`);
      db.close();
      process.exit(0);
    });
  });
} else if (command === 'deop') {
  // Забрать права администратора
  db.get('SELECT id, username, is_admin FROM users WHERE username = ?', [username], (err, user) => {
    if (err) {
      console.log('❌ Ошибка БД:', err.message);
      db.close();
      process.exit(1);
    }
    if (!user) {
      console.log(`❌ Пользователь "${username}" не найден`);
      db.close();
      process.exit(1);
    }
    if (!user.is_admin) {
      console.log(`⚠️  Пользователь "${username}" не является администратором`);
      db.close();
      process.exit(0);
    }

    db.run('UPDATE users SET is_admin = 0 WHERE id = ?', [user.id], function(err) {
      if (err) {
        console.log('❌ Ошибка обновления:', err.message);
        db.close();
        process.exit(1);
      }
      console.log(`✅ У пользователя "${username}" забраны права администратора`);
      console.log(`   ID: ${user.id}`);
      db.close();
      process.exit(0);
    });
  });
} else {
  console.log(`❌ Неизвестная команда: "${command}"`);
  console.log('   Доступные команды: op, deop');
  db.close();
  process.exit(1);
}
