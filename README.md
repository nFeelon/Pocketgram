# Pocketgram

Telegram-клиент для кнопочных телефонов на платформе [Cloud Phone](https://developer.cloudfone.com/).

Виджет рендерится в облачном Chromium на серверах CloudMosa и стримится на телефон. Расчёт — на экран QQVGA 128×160 и управление только клавишами: D-pad (стрелки + центр), левая и правая софт-клавиши.

**Стек:** React + TypeScript + Vite · MTProto-клиент [mtcute](https://mtcute.dev) (WebSocket + WASM) · React Router (HashRouter) · zustand. По мотивам официального [cloudphone-react-sample](https://github.com/cloudmosa/cloudphone-react-sample).

**Функции:** личные чаты, группы, каналы · текст · фото · видео и кружочки · голосовые.

Архитектура, ограничения платформы и тест-план — в [SPEC.md](SPEC.md).
