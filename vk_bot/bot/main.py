import vk_api
from vk_api.longpoll import VkLongPoll, VkEventType

def write_msg(user_id, message):
    vk.method('messages.send', {
        'user_id': user_id,
        'message': message,
        'random_id': 0
    })


# API-ключ созданный ранее
token = "vk1.a.-y-uzbN9xeeS6X-U4_e-p2P74rBUui25--qf55m-Yh9oVrd22yiF9NKXJ6ugOzV4hlxVPF1RPEwYaP_tbjDiPex5lormpsa8p3mSKCAsZtNf43P_9gLvo-eS2pwW5OQvSY0IRytVWSXvT8qocfINyVXy_mDlMzP36RV795ZMbe_O_Tjdl4xIl4edmm3-1x7AmdJgXVCYNk-OUUwe2w5ycg"

# Авторизуемся как сообщество
vk = vk_api.VkApi(token=token)

# Работа с сообщениями
longpoll = VkLongPoll(vk)

# Основной цикл
for event in longpoll.listen():

    # Если пришло новое сообщение
    if event.type == VkEventType.MESSAGE_NEW:
    
        # Если оно имеет метку для меня( то есть бота)
        if event.to_me:
        
            # Сообщение от пользователя
            request = event.text
            
            # Каменная логика ответа
            if request == "привет":
                write_msg(event.user_id, "Хай")
            elif request == "пока":
                write_msg(event.user_id, "Пока((")
            else:
                write_msg(event.user_id, "Не поняла вашего ответа...")
