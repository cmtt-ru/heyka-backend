## 4xx

### 400 Bad Request

В Swagger-документации описаны требования к запросу к каждому API-методу. Данная ошибка означает, что запрос не удовлетворяет данным требованиям.

```
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Invalid request payload input"
}
```

### 401 Unauthorized

Запрос к защищенному методу, не был предоставлен заголовок `Authorization: Bearer ${accessToken}`, либо `accessToken` недействителен (не найден, истек срок годности).

```
{
  "statusCode": 401,
  "error": "Unauthorized"
}
```

## 5xx

### 500 Bad Implementation

Такого быть не должно, но если случилось - в баги.

```
{
  "statusCode": 500,
  "error": "Internal Server Error",
  "message": "An internal server error occurred"
}
```
