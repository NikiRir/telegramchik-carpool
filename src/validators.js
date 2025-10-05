/**
 * Список городов Республики Татарстан и автокоррекция
 */
const TATARSTAN_CITIES = [
    'Казань', 'Набережные Челны', 'Нижнекамск', 'Альметьевск', 'Зеленодольск',
    'Бугульма', 'Елабуга', 'Лениногорск', 'Чистополь', 'Азнакаево',
    'Буинск', 'Мамадыш', 'Менделеевск', 'Тетюши', 'Агрыз',
    'Арск', 'Болгар', 'Верхний Услон', 'Высокая Гора', 'Заинск',
    'Иннополис', 'Кукмор', 'Лаишево', 'Муслюмово', 'Нурлат',
    'Пестрецы', 'Рыбная Слобода', 'Спасск', 'Ютазы'
];

const CITY_CORRECTIONS = {
    'чылны': 'Набережные Челны',
    'челны': 'Набережные Челны',
    'наб.челны': 'Набережные Челны',
    'наб челны': 'Набережные Челны',
    'мослим': 'Муслюмово',
    'мослимнэн': 'Муслюмово',
    'казан': 'Казань',
    'елабуга': 'Елабуга',
    'елабужка': 'Елабуга',
    'алмет': 'Альметьевск',
    'альмет': 'Альметьевск',
    'нкамск': 'Нижнекамск',
    'нижнекамск': 'Нижнекамск',
    'зеленка': 'Зеленодольск',
    'бугуль': 'Бугульма',
    'чистополь': 'Чистополь',
    'лениногорск': 'Лениногорск'
};

/**
 * Автокоррекция контактов
 */
const CONTACT_CORRECTIONS = {
    'ватсап': 'WhatsApp 📱',
    'вацап': 'WhatsApp 📱',
    'ватцап': 'WhatsApp 📱',
    'whatsapp': 'WhatsApp 📱',
    'watts': 'WhatsApp 📱',
    'вотсап': 'WhatsApp 📱',
    'vatsap': 'WhatsApp 📱',
    'вк': 'ВКонтакте 📘',
    'vk': 'ВКонтакте 📘',
    'vkontakte': 'ВКонтакте 📘',
    'вконтакте': 'ВКонтакте 📘',
    'одноклассники': 'Одноклассники 🟠',
    'ок': 'Одноклассники 🟠',
    'ok': 'Одноклассники 🟠',
    'одн': 'Одноклассники 🟠',
    'инста': 'Instagram 📷',
    'инстаграм': 'Instagram 📷',
    'instagram': 'Instagram 📷',
    'inst': 'Instagram 📷',
    'телега': 'Telegram 📨',
    'телеграм': 'Telegram 📨',
    'telegram': 'Telegram 📨',
    'тг': 'Telegram 📨'
};

/**
 * Автокоррекция городов Татарстана
 */
function correctCity(input) {
    const normalized = input.toLowerCase().trim();
    
    // Проверяем автокоррекцию
    if (CITY_CORRECTIONS[normalized]) {
        return {
            corrected: true,
            city: CITY_CORRECTIONS[normalized],
            original: input
        };
    }
    
    // Проверяем точное совпадение
    const exactMatch = TATARSTAN_CITIES.find(city => 
        city.toLowerCase() === normalized
    );
    
    if (exactMatch) {
        return {
            corrected: false,
            city: exactMatch,
            original: input
        };
    }
    
    // Проверяем частичное совпадение
    const partialMatch = TATARSTAN_CITIES.find(city => 
        city.toLowerCase().includes(normalized) || 
        normalized.includes(city.toLowerCase())
    );
    
    if (partialMatch) {
        return {
            corrected: true,
            city: partialMatch,
            original: input
        };
    }
    
    return {
        corrected: false,
        city: null,
        original: input
    };
}

/**
 * Автокоррекция контактов
 */
function correctContact(input) {
    let corrected = input;
    let wasCorrected = false;
    
    // Ищем ключевые слова и заменяем их
    for (const [key, value] of Object.entries(CONTACT_CORRECTIONS)) {
        const regex = new RegExp('\\b' + key + '\\b', 'gi');
        if (regex.test(corrected)) {
            corrected = corrected.replace(regex, value);
            wasCorrected = true;
        }
    }
    
    return {
        corrected: wasCorrected,
        contact: corrected,
        original: input
    };
}

/**
 * Форматирование даты и времени (простая версия - просто возвращаем что написали)
 */
function formatDateTime(input) {
    if (!input || input.trim().length === 0) {
        return {
            isValid: false,
            error: 'Укажите дату и время'
        };
    }
    
    // Просто возвращаем то, что написал пользователь
    return {
        isValid: true,
        formatted: input.trim()
    };
}

/**
 * Валидация контактных данных
 */
function validateContact(contact) {
    if (!contact || contact.trim().length < 2) {
        return {
            isValid: false,
            error: 'Контакт слишком короткий'
        };
    }
    
    const cleanContact = contact.trim();
    
    // Проверка на телефон
    const phonePattern = /^[\+]?[78]?[\s\-\(\)]?[0-9\s\-\(\)]{7,15}$/;
    if (phonePattern.test(cleanContact.replace(/\s/g, ''))) {
        return { isValid: true };
    }
    
    // Проверка на username Telegram
    if (cleanContact.startsWith('@') && cleanContact.length > 3) {
        return { isValid: true };
    }
    
    // Проверка на ссылку Telegram
    if (cleanContact.includes('t.me/') || cleanContact.includes('telegram.me/')) {
        return { isValid: true };
    }
    
    // Проверка на социальные сети
    if (cleanContact.includes('vk.com/') || cleanContact.includes('ok.ru/') || cleanContact.includes('wa.me/')) {
        return { isValid: true };
    }
    
    // Проверка на простой текст (имя)
    if (cleanContact.length >= 2 && /^[а-яёa-z\s0-9📱📘🟠📷📨\+\-\(\)]+$/i.test(cleanContact)) {
        return { isValid: true };
    }
    
    return {
        isValid: false,
        error: 'Укажите телефон, @username, ссылку или мессенджер'
    };
}

module.exports = {
    correctCity,
    correctContact,
    formatDateTime,
    validateContact,
    TATARSTAN_CITIES
};