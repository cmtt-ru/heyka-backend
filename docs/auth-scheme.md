Чтобы аутентифицировать запрос, нужно сообщить серверу `accessToken`, т.е. передать заголовок `Authorization: Bearer %accessToken%`. Например,

```
GET /me
Authorization: Bearer 7473522032956a23c3a2aef8f0ea7e09abaa5a0ec4653200a786d5bffbb770cb
```

Получить `accessToken` можно несколькими путями (все можно посмотреть в swagger-документации к API). Основной, это использовать метод авторизации с помощью логина/пароля:

```
POST /signin

{
	"credentials": {
		"email": "example@domain.com",
		"password": "password"
	}
}
```

Ответ будет содержать объект

```
{
  ...
  "credentials": {
    "accessToken": "710c90cd939bb3453779d42aa9ee7681c6957d095ba6d5cd71bed68d91950020", // короткоживущий токен
    "refreshToken": "b9263e1c977c87618164a4d21d0320bcadcef34fdf8ab943a148699a2ced6230", // долгоживущий токен для обновления короткоживущего
    "accessTokenExpiredAt": "2020-12-08T15:02:33.585Z", // время когда истечет accessToken, в проде время жизни токена 5 минут, ну а пока что час
    "refreshTokenExpiredAt": "2021-01-08T14:02:33.582Z" // время, когда истечет refreshToken, он живёт полгода
  }
}
```

Перед тем, как подойдёт время `accessTokenExpiredAt` нужно сделать запрос (если дата `refreshTokenExpiredAt` еще не наступила).

```
POST /refresh-token

{
  "accessToken": "710c90cd939bb3453779d42aa9ee7681c6957d095ba6d5cd71bed68d91950020",
  "refreshToken": "b9263e1c977c87618164a4d21d0320bcadcef34fdf8ab943a148699a2ced6230",
}
```

Ответ будет аналогичен запросу `POST /signin`, где оба токена будут обновлены.

```
{
  "accessToken": "string",
  "refreshToken": "string",
  "accessTokenExpiredAt": "2020-12-07T21:31:59.561Z",
  "refreshTokenExpiredAt": "2020-12-07T21:31:59.561Z"
}
```
