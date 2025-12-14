const socket = io();
let selectedChatId = null;
let messages = {};

// Инициализация
document.addEventListener('DOMContentLoaded', function() {
    loadActiveChats();
    setInterval(loadActiveChats, 30000); // Обновлять каждые 30 секунд
});

// Загрузка активных чатов
async function loadActiveChats() {
    try {
        const response = await fetch('/active-chats');
        const chats = await response.json();
        displayActiveChats(chats);
        updatePlatformCounts(chats);
    } catch (error) {
        console.error('Ошибка при загрузке чатов:', error);
    }
}

// Отображение активных чатов
function displayActiveChats(chats) {
    const container = document.getElementById('active-chats');
    container.innerHTML = '';
    
    chats.forEach(chat => {
        const chatElement = document.createElement('div');
        chatElement.className = `chat-item ${selectedChatId === chat.chat_id ? 'active' : ''}`;
        chatElement.onclick = () => selectChat(chat.chat_id, chat.username, chat.platform);
        
        const platformClass = `platform-${chat.platform}`;
        const platformIcon = chat.platform === 'telegram' ? 
            '<i class="fab fa-telegram"></i>' : 
            '<i class="fab fa-vk"></i>';
        
        chatElement.innerHTML = `
            <div class="chat-header">
                <div class="chat-user">
                    ${platformIcon}
                    <span>${chat.username}</span>
                </div>
                <span class="chat-platform ${platformClass}">${chat.platform}</span>
            </div>
            <div class="chat-preview">ID: ${chat.chat_id}</div>
            <div class="chat-time">${new Date(chat.lastActivity).toLocaleTimeString()}</div>
        `;
        
        container.appendChild(chatElement);
    });
}

// Обновление счетчиков платформ
function updatePlatformCounts(chats) {
    const telegramCount = chats.filter(c => c.platform === 'telegram').length;
    const vkCount = chats.filter(c => c.platform === 'vk').length;
    
    document.getElementById('telegram-count').textContent = telegramCount;
    document.getElementById('vk-count').textContent = vkCount;
}

// Выбор чата
function selectChat(chatId, username, platform) {
    selectedChatId = chatId;
    
    // Обновляем информацию о текущем чате
    const platformIcon = platform === 'telegram' ? 
        '<i class="fab fa-telegram"></i>' : 
        '<i class="fab fa-vk"></i>';
    
    document.getElementById('current-chat-info').innerHTML = `
        ${platformIcon} Чат с ${username} (${platform.toUpperCase()})
    `;
    
    document.getElementById('selected-chat-info').innerHTML = `
        <strong>Отправка в:</strong> ${username} (${platform.toUpperCase()}) | ID: ${chatId}
    `;
    
    // Показываем историю сообщений
    if (!messages[chatId]) {
        messages[chatId] = [];
    }
    displayMessages(chatId);
    
    // Обновляем активный элемент в списке
    document.querySelectorAll('.chat-item').forEach(item => {
        item.classList.remove('active');
    });
    event.currentTarget.classList.add('active');
    
    // Фокусируемся на поле ввода
    document.getElementById('sending_text').focus();
}

// Отображение сообщений
function displayMessages(chatId) {
    const container = document.getElementById('messages');
    container.innerHTML = '';
    
    if (messages[chatId]) {
        messages[chatId].forEach(msg => {
            addMessageToUI(msg);
        });
    }
    container.scrollTop = container.scrollHeight;
}

// Добавление сообщения в UI
function addMessageToUI(msg) {
    const container = document.getElementById('messages');
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${msg.isOperator ? 'message-operator' : 'message-user'}`;
    
    const platformIcon = msg.platform === 'telegram' ? 
        '<i class="fab fa-telegram"></i>' : 
        '<i class="fab fa-vk"></i>';
    
    messageDiv.innerHTML = `
        <div class="message-header">
            <div class="message-sender">
                ${platformIcon}
                <span>${msg.sender_nick}</span>
                <span class="message-platform">${msg.platform}</span>
            </div>
            <div class="message-time">${new Date(msg.timestamp).toLocaleTimeString()}</div>
        </div>
        <div class="message-content">${msg.text || (msg.photoUrl ? 
            `<div class="photo-container">
                <div class="photo-wrapper">
                    <img src="${msg.photoUrl}" alt="Фото">
                </div>
            </div>` : '')}
        </div>
    `;
    
    container.appendChild(messageDiv);
    container.scrollTop = container.scrollHeight;
}

// Socket обработчики
socket.on('newMessage', (msg) => {
    if (!messages[msg.chat_id]) {
        messages[msg.chat_id] = [];
    }
    messages[msg.chat_id].push(msg);
    
    if (selectedChatId === msg.chat_id) {
        addMessageToUI(msg);
    }
    
    // Обновляем список чатов
    loadActiveChats();
});

socket.on('newPhoto', (msg) => {
    if (!messages[msg.chat_id]) {
        messages[msg.chat_id] = [];
    }
    messages[msg.chat_id].push(msg);
    
    if (selectedChatId === msg.chat_id) {
        addMessageToUI(msg);
    }
});

// Отправка текста
function sendText() {
    if (!selectedChatId) {
        alert('Выберите чат для отправки сообщения');
        return;
    }
    
    const text = document.getElementById('sending_text').value.trim();
    if (!text) {
        alert('Введите текст сообщения');
        return;
    }
    
    fetch('/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            chat_id: selectedChatId, 
            sending_text: text 
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.message) {
            document.getElementById('sending_text').value = '';
        } else {
            alert('Ошибка: ' + (data.error || 'Неизвестная ошибка'));
        }
    })
    .catch(error => {
        console.error('Ошибка при отправке сообщения:', error);
        alert('Ошибка при отправке сообщения');
    });
}

// Отправка по Enter
function handleKeyPress(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendText();
    }
}

// Функции для клавиатуры
let keyboardButtons = [];

function addButton() {
    const input = document.getElementById('new_button_text');
    const text = input.value.trim();
    
    if (text) {
        keyboardButtons.push(text);
        updateButtonsList();
        input.value = '';
    }
}

function updateButtonsList() {
    const container = document.getElementById('button_vals');
    container.innerHTML = '';
    
    keyboardButtons.forEach((btn, index) => {
        const span = document.createElement('span');
        span.className = 'button-item';
        span.textContent = btn;
        container.appendChild(span);
    });
}

function deleteButtons() {
    keyboardButtons = [];
    updateButtonsList();
}

function showKeyboardModal() {
    if (!selectedChatId) {
        alert('Выберите чат для отправки клавиатуры');
        return;
    }
    
    if (selectedChatId.startsWith('vk_')) {
        alert('Клавиатуры поддерживаются только для Telegram');
        return;
    }
    
    document.getElementById('keyboard-modal').style.display = 'block';
}

function closeKeyboardModal() {
    document.getElementById('keyboard-modal').style.display = 'none';
}

function sendKeyboard() {
    const title = document.getElementById('keyboard_title').value.trim();
    const chatId = selectedChatId;
    
    if (!title) {
        alert('Введите заголовок для клавиатуры');
        return;
    }
    
    if (keyboardButtons.length < 2) {
        alert('Добавьте как минимум 2 кнопки');
        return;
    }
    
    fetch('/keyboard/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            chat_id: chatId, 
            title: title, 
            buttons: keyboardButtons 
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.message) {
            alert('Клавиатура отправлена!');
            closeKeyboardModal();
            keyboardButtons = [];
            document.getElementById('keyboard_title').value = '';
            updateButtonsList();
        } else {
            alert('Ошибка: ' + (data.error || 'Неизвестная ошибка'));
        }
    })
    .catch(error => {
        console.error('Ошибка при отправке клавиатуры:', error);
        alert('Ошибка при отправке клавиатуры');
    });
}

// Очистка чата
function clearChat() {
    if (selectedChatId && messages[selectedChatId]) {
        messages[selectedChatId] = [];
        displayMessages(selectedChatId);
    }
}

// Закрытие модального окна при клике вне его
window.onclick = function(event) {
    const modal = document.getElementById('keyboard-modal');
    if (event.target === modal) {
        closeKeyboardModal();
    }
}