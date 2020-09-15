# Socket API

Сокет-сервер реализован с помощью библиотеки [socket.io](https://socket.io), поэтому для подключения рекомендуется использовать эту же библиотеку на клиенте.

# Терминология

Web-socket события клиента, на которые подписывается сервер, задокументированы следующим образом:

```
socket.emit(eventName, {
  // Описание формата данных
  field1: String,
  field2: Number,
  fieldN: Boolean
})
```

А так - события сервера, на которые клиент может подписаться:

```
socket.on(eventName, data => {
  // data.field1: {String} Описание поля
  // data.field2: {Number} Описание
  // data.fieldN: {Array<Number>}
})
```

# Аутентификация

Просто подключиться к сокет-серверу недостаточно. Прежде чем клиент сможет получать\посылать события на сервер, подключение должно аутентифицироваться. Чтобы осуществить процедуру, нужно послать событие следующего формата:

```
socket.emit('auth', {
  transaction: String, // Уникальная строка, опционально
  token: String, // Access token, который клиент получил после аутентификации на сервере
  workspaceId: String, // Workspace id на события которого подписывается подключение
  onlineStatus: Enum['online', 'idle', 'offline'] // опционально, по умолчанию - 'online'
})
```

Индикатором того, что сокет теперь связан с аккаунтом пользователя, служит событие

```
socket.on('auth-success', data => {
  // data.transaction: {String} уникальная сторока, переданная с событием "auth"
  // data.userId: {String} id пользователя, который аутентифицирован
})
```

В случае неудачной аутентификации будет возвращена ошибка по схеме, описанной в разделе [ошибки](#ошибки)

# Ошибки

Клиент, вызывая событие, в объекте с данными может передать свойство `transaction` - произвольную строчку. Если в процессе обработки этого события произойдет ошибка, сервер сгенерирует два события в ответ:

```
socket.on('socket-api-error', error => {
  // error.event: {String} Название события, при обработке которого произошла ошибка
  // error.message: {String} Описание ошибки
})
```

```
let transaction = "..." // Уникальная строка, переданная в событии (например, в событии "auth")
socket.on(`socket-api-error-${transaction}`, error => {
  // error.message: {String} Текстовое описание ошибки
})
```

Таким образом, клиент может генерировать события, передавая с ним значение `transaction` и подписываться на событие `socket-api-error-${transaction}`, чтобы узнать об ошибке. Также клиент может слушать все ошибки, которые возникли при обработки событий с данного конкретного клиента, подписавшись на `socket-api-error`.

# События сервера

Чтобы сервер посылал нижеприведенные события, нужно для начала [аутентифицировать](#аутентификация) сокет соединение.

## Воркспейсы

### worskpace-updated (обновлена информация о воркспейсе)

```
socket.on('workspace-updated', data => {
  // data.workspace: {WorkspaceSchema}
})
```

## Каналы

### channel-created (канал создан)

```
socket.on('channel-created', data => {
  // data.channelId: {string} Id созданного канала
})
```

Подробную информацию о канале нужно запросить отдельно, потому что оповещение о созданном канале рассылается всем пользователям вокрспейса, но канал может быть приватный и не все пользователи имеют к нему доступ

### channel-updated (информация о канале обновлена)

```
socket.on('channel-updated', data => {
  // data.channel {ChannelSchema} Данные о канале
})
```

### channel-deleted (канал удалён)

```
socket.on('channel-deleted', data => {
  // data.channelId: {string} Id удалённого канала
})
```

## Пользователи

### user-joined (новый пользователь в воркспейсе)

```
socket.on('user-joined', data => {
  // data.user: {UserSchema} Объект с информацией о новом пользователе
})
```

### user-leaved-workspace (пользователь покинул воркспейс)

```
socket.on('user-leaved-workspace', data => {
  // data.userId: {uuid} id покинувшего воркспейс пользователя
  // data.workspaceId: {uuid} id workspace
})
```

### user-updated (обновление профиля пользователя)

```
socket.on('user-updated', data => {
  // data.user: {UserSchame} обновленное состояние пользователя
})
```

### me-updated (обновился профиль пользователя, который сейчас залогинен, внутри конфиденциальные данные)

```
socket.on('me-updated', data => {
  // data.user: {UserConfidentialDataScheme} обновление состоения пользователя с конфиденциальными данными
  // data.whatWasUpdated: {String} что было обновлено (подсказка). Варианты: 'social-auth', 'app-settings'
})
```

### user-selected-channel (юзер вошёл в канал)

```
socket.on('user-selected-channel', data => {
  // data.userId: {string} id пользователя
  // data.channelId: {string} id канала
  // data.userMediaState: {UserMediaStateSchema} состояние медиа пользователя
  // data.socketId: {string} socket id девайса, с которого был переключен канал
})
```

### user-unselected-channel (юзер вышел из канала)

```
socket.on('user-unselected-channel', data => {
  // data.userId: {string} id пользователя
  // data.channelId: {string} id канала
  // data.socketId: {string} socket id девайса, с которого был переключен канал
})
```

### user-changed-device (активный разговор на другом устройстве)

Если пользователь был в канале на одном устройстве, а затем присоединился к каналу в другом устройстве, то все клиенты пользователя получают сообщение о том, что девайс изменен. И тот клиент, который сейчас неактивен, но находится в активном разговоре - отсоединятся от Janus сервера

```
socket.on('user-changed-device', data => {
  // data: null
})
```

### online-status-updated (новый онлайн-статус пользователя)

```
socket.on('online-status-updated', data => {
  // data.userId: {string} id пользователя
  // data.onlineStatus: {Enum['online', 'idle', 'offline']}
})
```

### media-state-updated (обновление медиа-состояния пользователя)

```
socket.on('media-state-updated', data => {
  // data.userId: {string} id пользователя
  // data.userMediaState: {UserMediaStateSchema} состояние медиа пользователя
  // data.channelId: {string} id канала, в котором сейчас находится пользователь
})
```

## Пуши


### invite (новое приглашение в канал)

```
socket.on('invite', data => {
  // data.inviteId: {uuid} Уникальный идентификатор инвайта (для ответа на него, например)
  // data.isResponseNeeded: {boolean} Нужен ли ответ по этому инвайту
  // data.userId: {uuid} Кто отправил инвайт
  // data.workspaceId: {uuid} К какому workspace имеет отношение инвайт
  // data.channelId: {uuid} К какому каналу имеет отношение инвайт
  // data.message: {object} Произвольный JS-объект
})
```

### invite-response (ответ на инвайт)
```
socket.on('invite-response', data => {
  // data.inviteId: {uuid} Уникальный идентификатор сообщения, на который пришел ответ
  // data.userId: {uuid} Кто ответил
  // data.response: {object} Произвольный JS-объект
})
```

### invite-cancelled (определенный инвайт был отменен)
```
socket.on('invite-cancelled', data => {
  // data.inviteId: {uuid} Уникальный идентификатор сообщения, которое было отменено
})
```

## Персональные события

### kicked-from-workspace (доступ к workspace приостановлен)
```
socket.on('kicked-from-workspace', data => {
  // data.workspaceId: {uuid} из какого воркспейса вас выгнали
})
```

### muted-for-all (вас кто-то хочет замьютить)
```
socket.on('muted-for-all', data => {
  // data.fromUserId: {uuid} Id пользователя, который хочет вас замьютить
  // data.socketId: {string} Id коннекта, который должен быть замьючен
})
```
