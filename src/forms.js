/**
 * Создание формы объявления водителя
 */
function createDriverForm(data, userInfo, forPreview = true) {
    const contactLine = getContactLine(data.contact, userInfo);
    const signature = forPreview ? '' : getAutoSignature();
    
    return `🚙 Водитель

📍 Маршрут: ${data.from} → ${data.to}
🕒 Отъезд: ${data.datetime}
👥 Свободных мест: ${data.seats}
💰 Стоимость: ${data.price} ₽/чел

${contactLine}${signature}`;
}

/**
 * Создание формы заявки пассажира
 */
function createPassengerForm(data, userInfo, forPreview = true) {
    const contactLine = getContactLine(data.contact, userInfo);
    const signature = forPreview ? '' : getAutoSignature();
    
    return `🙋‍♂️ Пассажир

📍 Маршрут: ${data.from} → ${data.to}
🕒 Когда нужно: ${data.datetime}

${contactLine}${signature}`;
}

/**
 * Получение строки контакта (кликабельной по ID пользователя)
 */
function getContactLine(contact, userInfo) {
    // Создаем кликабельную ссылку на пользователя
    const userLink = `[${getUserDisplayName(userInfo)}](tg://user?id=${userInfo.id})`;
    
    // Если контакт указан - показываем контакт + ссылку на пользователя
    if (contact && contact !== 'Контакт не указан' && contact !== 'Свяжитесь через бот') {
        // Если контакт это username пользователя - показываем только кликабельную ссылку
        if (userInfo.username && contact === `@${userInfo.username}`) {
            return `📞 Контакт: ${userLink}`;
        }
        
        // Если контакт это имя пользователя - показываем только кликабельную ссылку
        if (userInfo.firstName && contact === userInfo.firstName) {
            return `📞 Контакт: ${userLink}`;
        }
        
        // Показываем контакт + кликабельную ссылку
        return `📞 Контакт: ${contact}\n👤 Автор: ${userLink}`;
    }
    
    // Если контакт не указан - показываем только кликабельную ссылку
    return `📞 Контакт: ${userLink}`;
}

/**
 * Получение отображаемого имени пользователя
 */
function getUserDisplayName(userInfo) {
    if (userInfo.username) {
        return `@${userInfo.username}`;
    } else if (userInfo.firstName) {
        const fullName = userInfo.lastName 
            ? `${userInfo.firstName} ${userInfo.lastName}`
            : userInfo.firstName;
        return fullName;
    }
    return 'Пользователь';
}

/**
 * Получение автоподписи из .env
 */
function getAutoSignature() {
    const signature = process.env.AUTO_SIGNATURE;
    if (signature && signature.trim() && signature !== 'true') {
        return `\n\n${signature}`;
    }
    return '';
}

module.exports = {
    createDriverForm,
    createPassengerForm
};
