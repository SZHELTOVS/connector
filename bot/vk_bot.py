import vk_api
from vk_api.longpoll import VkLongPoll, VkEventType
import requests
import json
import asyncio
import aiohttp
import os
from threading import Thread
from flask import Flask, request, jsonify

# Конфигурация
VK_TOKEN = os.getenv("VK_TOKEN", "vk1.a.-y-uzbN9xeeS6X-U4_e-p2P74rBUui25--qf55m-Yh9oVrd22yiF9NKXJ6ugOzV4hlxVPF1RPEwYaP_tbjDiPex5lormpsa8p3mSKCAsZtNf43P_9gLvo-eS2pwW5OQvSY0IRytVWSXvT8qocfINyVXy_mDlMzP36RV795ZMbe_O_Tjdl4xIl4edmm3-1x7AmdJgXVCYNk-OUUwe2w5ycg")
WEB_SERVER_URL = "http://web-server:3000"

class VKBot:
    def __init__(self, token):
        self.vk_session = vk_api.VkApi(token=token)
        self.vk = self.vk_session.get_api()
        self.longpoll = VkLongPoll(self.vk_session)
        self.user_cache = {}  # Кэш для имен пользователей

    def get_user_name(self, user_id):
        """Получаем имя пользователя VK"""
        if user_id in self.user_cache:
            return self.user_cache[user_id]
        
        try:
            user_info = self.vk.users.get(user_ids=user_id)[0]
            name = f"{user_info.get('first_name', '')} {user_info.get('last_name', '')}".strip()
            self.user_cache[user_id] = name
            return name
        except:
            return f"VK User {user_id}"

    def send_message(self, user_id, message):
        """Отправка сообщения пользователю VK"""
        try:
            self.vk.messages.send(
                user_id=user_id,
                message=message,
                random_id=0
            )
            print(f"[VK] Отправлено сообщение пользователю {user_id}: {message}")
            return True
        except Exception as e:
            print(f"Error sending VK message: {e}")
            return False

    async def forward_to_web(self, user_id, message_type, data):
        """Пересылаем сообщение на веб-сервер"""
        try:
            async with aiohttp.ClientSession() as session:
                url = f"{WEB_SERVER_URL}/{message_type}"
                async with session.post(url, json=data) as response:
                    if response.status != 200:
                        print(f"Error forwarding to web: {response.status}")
        except Exception as e:
            print(f"Error in forward_to_web: {e}")

    def run_listener(self):
        """Запуск прослушивания сообщений VK"""
        print("VK Bot listener started...")
        
        for event in self.longpoll.listen():
            if event.type == VkEventType.MESSAGE_NEW and event.to_me:
                user_id = event.user_id
                message_text = event.text
                user_name = self.get_user_name(user_id)
                
                # Формируем данные для веб-интерфейса
                data = {
                    'chat_id': f"vk_{user_id}",
                    'sender_nick': user_name,
                    'text': message_text,
                    'platform': 'vk'
                }
                
                # Асинхронно отправляем на веб-сервер
                asyncio.run(self.forward_to_web(user_id, 'user_message', data))

# Создаем Flask сервер для приема сообщений из веб-интерфейса
app = Flask(__name__)
vk_bot_instance = None

@app.route('/send_message', methods=['POST'])
def send_message_to_vk():
    """Эндпоинт для отправки сообщений в VK из веб-интерфейса"""
    try:
        data = request.get_json()
        chat_id = data.get('chat_id')
        text = data.get('text')
        
        if not chat_id or not text:
            return jsonify({'error': 'Missing chat_id or text'}), 400
        
        if not chat_id.startswith('vk_'):
            return jsonify({'error': 'Invalid VK chat_id format'}), 400
        
        # Извлекаем user_id из chat_id (формат: vk_123456)
        user_id = int(chat_id.split('_')[1])
        
        # Отправляем сообщение через VK API
        success = vk_bot_instance.send_message(user_id, text)
        
        if success:
            return jsonify({'success': True, 'message': 'Сообщение отправлено в VK'})
        else:
            return jsonify({'error': 'Failed to send message to VK'}), 500
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/health', methods=['GET'])
def health_check():
    """Проверка работоспособности"""
    return jsonify({'status': 'ok', 'service': 'vk-bot-api'})

def run_flask():
    """Запуск Flask сервера"""
    app.run(host='0.0.0.0', port=8081, debug=False)

if __name__ == "__main__":
    # Инициализируем VK бота
    vk_bot_instance = VKBot(VK_TOKEN)
    
    # Запускаем Flask сервер в отдельном потоке
    flask_thread = Thread(target=run_flask, daemon=True)
    flask_thread.start()
    print("VK Bot API started on port 8081")
    
    # Запускаем основной цикл прослушивания VK
    vk_bot_instance.run_listener()