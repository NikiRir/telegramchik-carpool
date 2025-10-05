require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { createDriverForm, createPassengerForm } = require('./forms');
const { validateContact, correctCity, formatDateTime, correctContact } = require('./validators');

// Инициализация бота
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const TARGET_CHAT_ID = process.env.CHAT_ID;
const SPAM_COOLDOWN = parseInt(process.env.SPAM_COOLDOWN) || 7;

// Хранилище данных пользователей
const userSessions = {};
const userLastPost = {};

console.log('🚗 Бот попутчиков запущен!');
console.log('🎯 Группа для объявлений:', TARGET_CHAT_ID);

// Команда /start
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const welcomeMessage = `🚗 Добро пожаловать в бот, который поможет вам опубликовать объявление

Выберите, водитель вы или пассажир:`;
    
    const keyboard = {
        inline_keyboard: [
            [
                { text: '🚙 Я водитель', callback_data: 'start_driver' },
                { text: '🙋‍♂️ Я пассажир', callback_data: 'start_passenger' }
            ],
            [
                { text: '❓ Справка', callback_data: 'help' }
            ]
        ]
    };
    
    bot.sendMessage(chatId, welcomeMessage, { 
        reply_markup: keyboard 
    });
});

// Команда /help
bot.onText(/\/help/, (msg) => {
    showHelp(msg.chat.id);
});

function showHelp(chatId) {
    const helpMessage = `📖 Справка по боту попутчиков

🚙 Для водителей:
- Откуда и куда едете (города Татарстана)
- Дата и время поездки
- Количество свободных мест
- Стоимость поездки
- Ваши контакты (можно пропустить)

🙋‍♂️ Для пассажиров:
- Откуда и куда нужно добраться
- Когда нужна поездка
- Ваши контакты (можно пропустить)

⚙️ Особенности:
- Автокоррекция городов (Чылны → Набережные Челны)
- Автокоррекция контактов (ватсап → WhatsApp 📱)
- Защита от спама - ${SPAM_COOLDOWN} минут между постами
- Кликабельные контакты в объявлениях
- Автоподпись в конце объявлений`;
    
    bot.sendMessage(chatId, helpMessage);
}

// Обработка нажатий на кнопки
bot.on('callback_query', (callbackQuery) => {
    const message = callbackQuery.message;
    const data = callbackQuery.data;
    const userId = callbackQuery.from.id;
    const chatId = message.chat.id;
    
    console.log('🔔 Нажата кнопка:', data, 'пользователь:', userId);
    
    // Отвечаем на callback
    bot.answerCallbackQuery(callbackQuery.id);
    
    if (data === 'start_driver') {
        bot.editMessageReplyMarkup(null, {
            chat_id: chatId,
            message_id: message.message_id
        });
        startDriverFlow(chatId, userId, callbackQuery.from);
        
    } else if (data === 'start_passenger') {
        bot.editMessageReplyMarkup(null, {
            chat_id: chatId,
            message_id: message.message_id
        });
        startPassengerFlow(chatId, userId, callbackQuery.from);
        
    } else if (data === 'help') {
        showHelp(chatId);
        
    } else if (data === 'skip_contact') {
        console.log('🔄 Пропуск контактов для пользователя:', userId);
        bot.editMessageText('⏭️ Контакты пропущены, формирую объявление...', {
            chat_id: chatId,
            message_id: message.message_id
        });
        
        setTimeout(() => {
            handleSkipContact(chatId, userId);
        }, 500);
        
    } else if (data.startsWith('publish_driver_')) {
        console.log('📤 Публикация объявления водителя');
        bot.editMessageText('📤 Публикую объявление...', {
            chat_id: chatId,
            message_id: message.message_id
        });
        publishDriverAd(chatId, userId);
        
    } else if (data.startsWith('publish_passenger_')) {
        console.log('📤 Публикация заявки пассажира');
        bot.editMessageText('📤 Публикую заявку...', {
            chat_id: chatId,
            message_id: message.message_id
        });
        publishPassengerAd(chatId, userId);
        
    } else if (data.startsWith('cancel_')) {
        console.log('❌ Отмена объявления');
        bot.editMessageText('❌ Объявление отменено', {
            chat_id: chatId,
            message_id: message.message_id
        });
        cancelSession(chatId, userId);
    }
});

// Запуск потока водителя
function startDriverFlow(chatId, userId, userFrom) {
    // Проверка антиспама
    if (userLastPost[userId]) {
        const timeDiff = (Date.now() - userLastPost[userId]) / 1000 / 60;
        if (timeDiff < SPAM_COOLDOWN) {
            const remaining = Math.ceil(SPAM_COOLDOWN - timeDiff);
            bot.sendMessage(chatId, `⏰ Подождите ${remaining} мин. перед следующим объявлением`);
            return;
        }
    }
    
    userSessions[userId] = {
        type: 'driver',
        step: 'from',
        data: {},
        userInfo: {
            id: userId,
            firstName: userFrom.first_name,
            lastName: userFrom.last_name,
            username: userFrom.username
        }
    };
    
    console.log('🚗 Создана сессия водителя для:', userId);
    
    const keyboard = {
        inline_keyboard: [
            [{ text: '❌ Отменить', callback_data: `cancel_${userId}` }]
        ]
    };
    
    bot.sendMessage(chatId, '🚙 Создание объявления водителя\n\n📍 Откуда едете? (город в Татарстане)', {
        reply_markup: keyboard
    });
}

// Запуск потока пассажира
function startPassengerFlow(chatId, userId, userFrom) {
    // Проверка антиспама
    if (userLastPost[userId]) {
        const timeDiff = (Date.now() - userLastPost[userId]) / 1000 / 60;
        if (timeDiff < SPAM_COOLDOWN) {
            const remaining = Math.ceil(SPAM_COOLDOWN - timeDiff);
            bot.sendMessage(chatId, `⏰ Подождите ${remaining} мин. перед следующим объявлением`);
            return;
        }
    }
    
    userSessions[userId] = {
        type: 'passenger', 
        step: 'from',
        data: {},
        userInfo: {
            id: userId,
            firstName: userFrom.first_name,
            lastName: userFrom.last_name,
            username: userFrom.username
        }
    };
    
    console.log('🙋‍♂️ Создана сессия пассажира для:', userId);
    
    const keyboard = {
        inline_keyboard: [
            [{ text: '❌ Отменить', callback_data: `cancel_${userId}` }]
        ]
    };
    
    bot.sendMessage(chatId, '🙋‍♂️ Создание заявки пассажира\n\n📍 Откуда нужно забрать? (город в Татарстане)', {
        reply_markup: keyboard
    });
}

// Обработка сообщений
bot.on('message', (msg) => {
    if (msg.text && !msg.text.startsWith('/')) {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const session = userSessions[userId];
        
        if (!session) return;
        
        handleUserInput(chatId, userId, msg.text, session);
    }
});

// Функция обработки ввода
function handleUserInput(chatId, userId, text, session) {
    if (session.type === 'driver') {
        handleDriverInput(chatId, userId, text, session);
    } else if (session.type === 'passenger') {
        handlePassengerInput(chatId, userId, text, session);
    }
}

// Обработка ввода водителя
function handleDriverInput(chatId, userId, text, session) {
    const { step, data } = session;
    
    const cancelKeyboard = {
        inline_keyboard: [
            [{ text: '❌ Отменить', callback_data: `cancel_${userId}` }]
        ]
    };
    
    switch (step) {
        case 'from':
            const fromCorrection = correctCity(text);
            if (!fromCorrection.city) {
                bot.sendMessage(chatId, '❌ Город не найден в Татарстане. Попробуйте еще раз.\n\nПримеры: Казань, Челны, Альметьевск, Елабуга', {
                    reply_markup: cancelKeyboard
                });
                return;
            }
            
            data.from = fromCorrection.city;
            session.step = 'to';
            
            bot.sendMessage(chatId, '📍 Куда едете? (город в Татарстане)', {
                reply_markup: cancelKeyboard
            });
            break;
            
        case 'to':
            const toCorrection = correctCity(text);
            if (!toCorrection.city) {
                bot.sendMessage(chatId, '❌ Город не найден в Татарстане. Попробуйте еще раз.\n\nПримеры: Казань, Челны, Альметьевск, Елабуга', {
                    reply_markup: cancelKeyboard
                });
                return;
            }
            
            // ПРОВЕРКА ОДИНАКОВЫХ ГОРОДОВ
            if (toCorrection.city === data.from) {
                bot.sendMessage(chatId, '❌ Город отправления и назначения не могут быть одинаковыми. Выберите другой город.', {
                    reply_markup: cancelKeyboard
                });
                return;
            }
            
            data.to = toCorrection.city;
            session.step = 'datetime';
            
            bot.sendMessage(chatId, '🕒 Дата и время отъезда?\n(например: "завтра в 15:00" или "сегодня в 09:30")', {
                reply_markup: cancelKeyboard
            });
            break;
            
        case 'datetime':
            const dateTimeValidation = formatDateTime(text);
            if (!dateTimeValidation.isValid) {
                bot.sendMessage(chatId, `❌ ${dateTimeValidation.error}\n\nПримеры: "завтра в 15:00", "сегодня в 09:30", "05.10 в 14:20"`, {
                    reply_markup: cancelKeyboard
                });
                return;
            }
            
            data.datetime = dateTimeValidation.formatted;
            session.step = 'seats';
            bot.sendMessage(chatId, '👥 Количество свободных мест? (число от 1 до 8)', {
                reply_markup: cancelKeyboard
            });
            break;
            
        case 'seats':
            if (isNaN(text) || parseInt(text) < 1 || parseInt(text) > 8) {
                bot.sendMessage(chatId, '❌ Укажите количество мест числом от 1 до 8', {
                    reply_markup: cancelKeyboard
                });
                return;
            }
            data.seats = parseInt(text);
            session.step = 'price';
            bot.sendMessage(chatId, '💰 Стоимость с человека? (в рублях, число)', {
                reply_markup: cancelKeyboard
            });
            break;
            
        case 'price':
            if (isNaN(text) || parseInt(text) < 0) {
                bot.sendMessage(chatId, '❌ Укажите стоимость числом (0 = бесплатно)', {
                    reply_markup: cancelKeyboard
                });
                return;
            }
            data.price = parseInt(text);
            session.step = 'contact';
            askForContact(chatId, userId);
            break;
            
        case 'contact':
            // Автокоррекция контактов
            const contactCorrection = correctContact(text);
            let finalContact = contactCorrection.contact;
            
            const contactValidation = validateContact(finalContact);
            if (!contactValidation.isValid) {
                bot.sendMessage(chatId, `❌ ${contactValidation.error}\n\nИли нажмите "Пропустить" чтобы использовать ваш Telegram`, {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '⏭️ Пропустить', callback_data: 'skip_contact' }],
                            [{ text: '❌ Отменить', callback_data: `cancel_${userId}` }]
                        ]
                    }
                });
                return;
            }
            
            data.contact = finalContact;
            
            showDriverPreview(chatId, userId, data, session.userInfo);
            break;
    }
}

// Обработка ввода пассажира
function handlePassengerInput(chatId, userId, text, session) {
    const { step, data } = session;
    
    const cancelKeyboard = {
        inline_keyboard: [
            [{ text: '❌ Отменить', callback_data: `cancel_${userId}` }]
        ]
    };
    
    switch (step) {
        case 'from':
            const fromCorrection = correctCity(text);
            if (!fromCorrection.city) {
                bot.sendMessage(chatId, '❌ Город не найден в Татарстане. Попробуйте еще раз.\n\nПримеры: Казань, Челны, Альметьевск, Елабуга', {
                    reply_markup: cancelKeyboard
                });
                return;
            }
            
            data.from = fromCorrection.city;
            session.step = 'to';
            
            bot.sendMessage(chatId, '📍 Куда нужно добраться? (город в Татарстане)', {
                reply_markup: cancelKeyboard
            });
            break;
            
        case 'to':
            const toCorrection = correctCity(text);
            if (!toCorrection.city) {
                bot.sendMessage(chatId, '❌ Город не найден в Татарстане. Попробуйте еще раз.\n\nПримеры: Казань, Челны, Альметьевск, Елабуга', {
                    reply_markup: cancelKeyboard
                });
                return;
            }
            
            // ПРОВЕРКА ОДИНАКОВЫХ ГОРОДОВ
            if (toCorrection.city === data.from) {
                bot.sendMessage(chatId, '❌ Город отправления и назначения не могут быть одинаковыми. Выберите другой город.', {
                    reply_markup: cancelKeyboard
                });
                return;
            }
            
            data.to = toCorrection.city;
            session.step = 'datetime';
            
            bot.sendMessage(chatId, '🕒 Когда нужна поездка?\n(например: "завтра в 15:00" или "сегодня в 09:30")', {
                reply_markup: cancelKeyboard
            });
            break;
            
        case 'datetime':
            const dateTimeValidation = formatDateTime(text);
            if (!dateTimeValidation.isValid) {
                bot.sendMessage(chatId, `❌ ${dateTimeValidation.error}\n\nПримеры: "завтра в 15:00", "сегодня в 09:30", "05.10 в 14:20"`, {
                    reply_markup: cancelKeyboard
                });
                return;
            }
            
            data.datetime = dateTimeValidation.formatted;
            session.step = 'contact';
            askForContact(chatId, userId);
            break;
            
        case 'contact':
            // Автокоррекция контактов
            const contactCorrection = correctContact(text);
            let finalContact = contactCorrection.contact;
            
            const contactValidation = validateContact(finalContact);
            if (!contactValidation.isValid) {
                bot.sendMessage(chatId, `❌ ${contactValidation.error}\n\nИли нажмите "Пропустить" чтобы использовать ваш Telegram`, {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '⏭️ Пропустить', callback_data: 'skip_contact' }],
                            [{ text: '❌ Отменить', callback_data: `cancel_${userId}` }]
                        ]
                    }
                });
                return;
            }
            
            data.contact = finalContact;
            
            showPassengerPreview(chatId, userId, data, session.userInfo);
            break;
    }
}

// Запрос контакта с кнопкой пропустить
function askForContact(chatId, userId) {
    const keyboard = {
        inline_keyboard: [
            [{ text: '⏭️ Пропустить', callback_data: 'skip_contact' }],
            [{ text: '❌ Отменить', callback_data: `cancel_${userId}` }]
        ]
    };
    
    bot.sendMessage(chatId, `📞 Ваш контакт для связи?

📱 Примеры:
- ватсап +7 999 123-45-67

Или нажмите "Пропустить", если хотите, чтобы с вами связывались по Telegram.`, {
        reply_markup: keyboard
    });
}

// Обработка пропуска контакта
function handleSkipContact(chatId, userId) {
    console.log('🔧 Обработка пропуска контактов для пользователя:', userId);
    
    const session = userSessions[userId];
    if (!session) {
        console.log('❌ Сессия не найдена для пользователя:', userId);
        bot.sendMessage(chatId, '❌ Сессия истекла. Начните заново с /start');
        return;
    }
    
    // Устанавливаем контакт
    if (session.userInfo.username) {
        session.data.contact = `@${session.userInfo.username}`;
    } else if (session.userInfo.firstName) {
        session.data.contact = session.userInfo.firstName;
    } else {
        session.data.contact = 'Свяжитесь через бот';
    }
    
    console.log('💾 Контакт установлен:', session.data.contact);
    
    // Показываем предпросмотр
    try {
        if (session.type === 'driver') {
            showDriverPreview(chatId, userId, session.data, session.userInfo);
        } else if (session.type === 'passenger') {
            showPassengerPreview(chatId, userId, session.data, session.userInfo);
        }
    } catch (error) {
        console.error('❌ Ошибка при показе предпросмотра:', error);
        bot.sendMessage(chatId, '❌ Произошла ошибка. Попробуйте еще раз или начните заново с /start');
    }
}

// Предпросмотр водителя
function showDriverPreview(chatId, userId, data, userInfo) {
    console.log('🎬 Формируем предпросмотр водителя');
    
    try {
        // Используем forPreview = true чтобы убрать автоподпись
        const preview = createDriverForm(data, userInfo, true);
        
        const keyboard = {
            inline_keyboard: [
                [
                    { text: '✅ Опубликовать', callback_data: `publish_driver_${userId}` },
                    { text: '❌ Отменить', callback_data: `cancel_${userId}` }
                ]
            ]
        };
        
        bot.sendMessage(chatId, `📝 Предпросмотр объявления:\n\n${preview}`, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
        
        console.log('✅ Предпросмотр водителя отправлен');
    } catch (error) {
        console.error('❌ Ошибка при формировании предпросмотра водителя:', error);
        bot.sendMessage(chatId, '❌ Ошибка при формировании предпросмотра');
    }
}

// Предпросмотр пассажира
function showPassengerPreview(chatId, userId, data, userInfo) {
    console.log('🎬 Формируем предпросмотр пассажира');
    
    try {
        // Используем forPreview = true чтобы убрать автоподпись
        const preview = createPassengerForm(data, userInfo, true);
        
        const keyboard = {
            inline_keyboard: [
                [
                    { text: '✅ Опубликовать', callback_data: `publish_passenger_${userId}` },
                    { text: '❌ Отменить', callback_data: `cancel_${userId}` }
                ]
            ]
        };
        
        bot.sendMessage(chatId, `📝 Предпросмотр заявки:\n\n${preview}`, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
        
        console.log('✅ Предпросмотр пассажира отправлен');
    } catch (error) {
        console.error('❌ Ошибка при формировании предпросмотра пассажира:', error);
        bot.sendMessage(chatId, '❌ Ошибка при формировании предпросмотра');
    }
}

// Публикация водителя
function publishDriverAd(chatId, userId) {
    const session = userSessions[userId];
    if (!session) {
        bot.sendMessage(chatId, '❌ Сессия не найдена');
        return;
    }
    
    // Используем forPreview = false чтобы добавить автоподпись
    const message = createDriverForm(session.data, session.userInfo, false);
    
    bot.sendMessage(TARGET_CHAT_ID, message, { parse_mode: 'Markdown' })
        .then(() => {
            bot.sendMessage(chatId, '✅ Объявление успешно опубликовано!');
            userLastPost[userId] = Date.now();
            delete userSessions[userId];
        })
        .catch((error) => {
            console.error('Ошибка публикации:', error);
            bot.sendMessage(chatId, '❌ Ошибка публикации. Проверьте настройки бота.');
        });
}

// Публикация пассажира
function publishPassengerAd(chatId, userId) {
    const session = userSessions[userId];
    if (!session) {
        bot.sendMessage(chatId, '❌ Сессия не найдена');
        return;
    }
    
    // Используем forPreview = false чтобы добавить автоподпись
    const message = createPassengerForm(session.data, session.userInfo, false);
    
    bot.sendMessage(TARGET_CHAT_ID, message, { parse_mode: 'Markdown' })
        .then(() => {
            bot.sendMessage(chatId, '✅ Заявка успешно опубликована!');
            userLastPost[userId] = Date.now();
            delete userSessions[userId];
        })
        .catch((error) => {
            console.error('Ошибка публикации:', error);
            bot.sendMessage(chatId, '❌ Ошибка публикации. Проверьте настройки бота.');
        });
}

// Отмена сессии
function cancelSession(chatId, userId) {
    delete userSessions[userId];
    bot.sendMessage(chatId, '❌ Создание объявления отменено. Напишите /start для начала.');
}

// Обработка ошибок
bot.on('error', (error) => {
    console.error('❌ Ошибка бота:', error);
});

bot.on('polling_error', (error) => {
    console.error('❌ Ошибка polling:', error);
});

console.log('✅ Бот готов к работе!');