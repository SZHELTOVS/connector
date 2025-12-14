const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(__dirname));
app.use('/static', express.static(__dirname + '/static'));

// Хранилище активных чатов
const activeChats = new Map();

// Эндпоинт для получения сообщений от ботов
app.post('/user_message', (req, res) => {
  const chat_id = req.body.chat_id;
  const sender_nick = req.body.sender_nick;
  const text = req.body.text;
  const platform = req.body.platform || 'telegram';
  
  if (chat_id && sender_nick && text) {
    // Обновляем информацию о чате
    activeChats.set(chat_id, {
      platform,
      username: sender_nick,
      lastActivity: new Date()
    });
    
    io.emit('newMessage', { chat_id, sender_nick, text, platform, timestamp: new Date() });
    res.status(200).send('Сообщение получено');
  } else {
    res.status(400).send('Сообщение не предоставлено');
  }
});

// Эндпоинт для получения фото
app.post('/user_photo', (req, res) => {
  const { chat_id, sender_nick, photoUrl, platform = 'telegram' } = req.body;
  if (chat_id && sender_nick && photoUrl) {
    io.emit('newPhoto', { chat_id, sender_nick, photoUrl, platform, timestamp: new Date() });
    res.status(200).send('ok');
  } else res.status(400).send('Ошибка');
});

// Функция для отправки сообщений в VK
async function handle_vk_message_from_web(data) {
  const chat_id = data.chat_id;
  const text = data.text;
  
  if (chat_id && text && chat_id.startsWith('vk_')) {
    try {
      console.log(`[VK] Отправка сообщения пользователю ${chat_id}: ${text}`);
      // В реальном приложении здесь будет вызов VK API
      return { success: true, platform: 'vk' };
    } catch (error) {
      return { error: error.message, platform: 'vk' };
    }
  }
  return { error: 'Invalid data', platform: 'vk' };
}

// Эндпоинт для отправки сообщения в мессенджеры
// В функции отправки сообщений добавьте обработку VK
app.post('/message', async (req, res) => {
  const chat_id = req.body.chat_id;
  const text = req.body.sending_text;
  
  if (!chat_id || !text) {
    return res.status(400).json({ error: 'Не указаны chat_id или text' });
  }

  try {
    let response;
    
    // Определяем платформу по chat_id
    if (chat_id.startsWith('vk_')) {
      // Для VK - отправляем на Flask API VK бота
      const fetch = (await import('node-fetch')).default;
      response = await fetch('http://vk-bot:8081/send_message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id, text })
      });
      response = await response.json();
      
      if (!response.success) {
        throw new Error(response.error || 'Ошибка отправки в VK');
      }
    } else {
      // Для Telegram
      const fetch = (await import('node-fetch')).default;
      response = await fetch('http://telegram-bot:8080/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id, text })
      });
      response = await response.json();
    }
    
    // Отправляем сообщение обратно в веб-интерфейс
    io.emit('newMessage', {
      chat_id,
      sender_nick: 'Оператор',
      text,
      platform: chat_id.startsWith('vk_') ? 'vk' : 'telegram',
      timestamp: new Date(),
      isOperator: true
    });
    
    res.status(200).json({ 
      message: 'Сообщение отправлено',
      platform: chat_id.startsWith('vk_') ? 'vk' : 'telegram'
    });
  } catch (error) {
    console.error('Ошибка при отправке сообщения:', error);
    res.status(500).json({ error: error.message || 'Не удалось отправить сообщение' });
  }
});

// Эндпоинт для получения списка активных чатов
app.get('/active-chats', (req, res) => {
  const chats = Array.from(activeChats.entries()).map(([chat_id, info]) => ({
    chat_id,
    ...info
  }));
  res.json(chats);
});

// Эндпоинт для клавиатур (только Telegram)
app.post('/keyboard/create', (req, res) => {
  const chat_id = req.body.chat_id;
  const title = req.body.title;
  const buttons = req.body.buttons;

  if (!chat_id || !title || !buttons || buttons.length < 2) {
    return res.status(400).json({ error: 'Не указаны chat_id, title или недостаточно кнопок' });
  }

  // Клавиатуры только для Telegram
  if (chat_id.startsWith('vk_')) {
    return res.status(400).json({ error: 'Клавиатуры поддерживаются только для Telegram' });
  }

  // Отправляем в Telegram бот
  fetch('http://telegram-bot:8080/keyboard/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id, title, buttons })
  })
  .then(response => response.json())
  .then(data => {
    if (data.error) {
      res.status(500).json({ error: data.error });
    } else {
      res.status(200).json({ message: 'Клавиатура успешно отправлена' });
    }
  })
  .catch(error => {
    console.error('Ошибка при отправке клавиатуры:', error);
    res.status(500).json({ error: 'Не удалось отправить клавиатуру' });
  });
});

// Сервируем HTML
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

server.listen(3000, () => {
  console.log('Веб-сервер запущен на порту 3000');
  console.log('Поддерживаемые платформы: Telegram, VK');
});