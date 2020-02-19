# heyka-backend

# Запуск

1. Поставить пакетный менеджер Yarn (`npm install --global yarn`)
2. Установить зависимые пакеты (`yarn`)
3. Запустить Redis и PostgreSQL сервера, создать базу данных для приложения в PostgresQL
4. Сделать дубликат файла `.env.example`, назвать его `.env`. Отредактировать файл, задав все переменные.
5. Запустить миграции (`yarn run migrate up`)
6. (Опционально) Запустить тесты (`yarn test`)
7. Запустить сервер в режиме разработки (`yarn run dev`). Будет доступен Swagger по роуту `/documentation`, а также расширенное логирование в консоль.
8. Или запустить сервер в production режиме (`yarn start`).

# Swagger

Если запустить сервер с параметром окружения `NODE_ENV=development`, то по роуту `/documentation` будет доступна API-документация.

# Тестирование

Запустите `yarn test`, чтобы сделать полное тестирования приложения. Для полного тестирования понадобятся запущенные Redis и Postgres сервер и установленные переменные окружения в файле `.env`.

# Линтер

По команде `yarn run lint` можно проверить соответствие кода установленному style-guide.

# Запуск Janus-сервера

Из каталога `docker/janus` построить образ с помощью Dockerfile, затем запустить контейнер командой по типу `docker run -d --name janus -p 10000-10200:10000-10200/udp -p 8088:8088 -p 7088:7088 -v %ABSOLUTE_PATH_TO_PROJECT_DIRECTORY%/docker/janus/conf:/opt/janus/etc/janus %JANUS_IMAGE_NAME%`.

Для запуска Janus-сервера в интерактивном режиме (чтобы видеть логи), добавьте вместо аргумента `-d` аргументы `-it`.

# Параметры деплоя Janus-сервера.

При деплое Janus-сервера для веб-сервера Хейки необходимо предоставить возможность указать следующие параметры:
- `janus.cfg[admin_secret]`
- `janus.plugin.audiobridge.jcfg[general.admin_key]`
- `janus.plugin.videoroom.jcfg[general.admin_key]`