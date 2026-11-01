# Pocketgram — техническое задание

Telegram-клиент (виджет) для кнопочных телефонов на платформе **Cloud Phone** (CloudMosa). Одностраничное веб-приложение: список диалогов, переписка, просмотр медиа. Целевое устройство — **HMD 101 4G** (S30+, Unisoc 8910 FF-S, экран 2″ ~120×160 QQVGA, 16МБ RAM, без клавиш громкости); целевой экран — **QQVGA ≤128×160**, вторичный — QVGA 240×320.

---

## 1. Платформа: что такое Cloud Phone

Cloud Phone — **удалённый браузер**. Виджет исполняется Chromium-сервером CloudMosa, результат конвертируется в векторный формат PVGL и стримится на телефон; телефон шлёт только события клавиш. Следствия:

- Современный HTML/CSS/JS/WASM — без ограничений по весу бандла (загрузка идёт по каналу дата-центра, не по каналу телефона).
- Трафик пользователя тратится на **обновления экрана**, а не на загрузку ресурсов: видео ≈ **120 МБ/час на QQVGA** (360 МБ/час на QVGA). Анимации и частые перерисовки дороже загрузки данных — минимум анимаций.
- Макс. ~20 FPS, есть RTT-задержка на каждый рендер — интерфейс должен быть «диалоговым», а не «живым».
- Запросы приложения идут с **IP дата-центров CloudMosa** (Сингапур/США), не с IP пользователя. Реальный IP приходит в `X-Forwarded-For`.
- Только **HTTPS/WSS**. HTTP и mixed content заблокированы.

### Поддерживается
WebSocket, fetch/XHR/SSE, WASM, IndexedDB (blob ≤ **50 МБ**), localStorage (≤ 5 МБ), cookies, Web Crypto, `<audio>` (MP4/Ogg/WebM/WAV; FLAC/MP3/**Opus**/Vorbis/AAC), `<video>` (**MP4 H.264 + AAC**), нативный HLS (HLSv7), blob URL, `getUserMedia` (микрофон, CP 3.0+), `input[type=file]` (фича `FileUpload`/`ImageUpload`), `<a download>` (фича `FileDownload`), `navigator.vibrate` (фича `Vibrate`).

### Не поддерживается
WebRTC, WebAudio API, Media Source Extensions (MSE), Encrypted Media Extensions (DRM), `playbackRate`, `element.volume` (вместо него `navigator.volumeManager`), `readyState`/`buffered` у медиа-элементов, `alert()`/`confirm()`/`prompt()`, сетевой `navigator.connection`, popup-окна (single-tab), persistent storage (`navigator.storage.persist()` всегда false).

### Управление
| Ключ | Событие |
|---|---|
| D-pad ↑↓←→ | `ArrowUp/Down/Left/Right` (+`repeat` при удержании) |
| Центр D-pad | `Enter` / `click` |
| LSK (левая софт-клавиша) | `Escape` |
| RSK (правая) | **не keydown**: `history.back()`, либо событие `window 'back'` (preventDefault — кастомная обработка; при пустой истории — `window.close()`) |
| Цифры | `0-9`, `*`, `#` |

Конвенция: LSK = меню/опции, RSK = назад/выход. Текстовый ввод — нативный IME при фокусе на `<input>` (полноэкранный; на новых клиентах встроенный — фича `EmbeddedTextInput`). **Эмодзи IME не вводит.** Атрибут `x-puffin-entersfullscreen="off"` отключает полноэкранный IME (тогда ввод только перехватом клавиш). `<video>` по умолчанию играется полноэкранно; атрибут `x-puffin-playsinline` — инлайн.

### Хранение
localStorage/IndexedDB/cookies хранятся на серверах CloudMosa, **зашифрованы ключом, живущим на устройстве**. «Clear Data» на телефоне стирает всё → потребуется повторный логин. HTTP-кэши эфемерны (живут в пределах сессии приложения).

### Экраны и вёрстка
- QQVGA 128×160 (основной), QVGA 240×320. Media queries: `max-width:128px` / `129–240px`.
- Хедер ~20px (QQVGA) / 40px (QVGA); софткей-бар 20px / 36px; поля 4pt / 8pt.
- Шрифты Roboto: header bold 14pt / 24pt; body 12pt / 16pt; footnote 10pt / 12pt.
- Рекомендована тёмная тема (низкоконтрастные экраны), `prefers-color-scheme` всегда `light` — тему задавать самим.

---

## 2. Стек и обоснование

| Компонент | Выбор | Почему |
|---|---|---|
| Язык/фреймворк | **React 19 + TypeScript** | Официальный туториал Cloud Phone и образцовый репозиторий на React; типы mtcute сильно облегчают работу с MTProto-объектами |
| Сборка | **Vite 6** | Стандарт сэмпла; `optimizeDeps.exclude: ['@mtcute/wasm']` обязательно (vite#8427) |
| Роутинг | **react-router `HashRouter`** | GitHub Pages не отдаёт SPA-роуты; RSK=history.back() работает из коробки. **Модалки/меню — это записи истории** (`navigate('#menu')`), RSK закрывает их бесплатно |
| MTProto | **`@mtcute/web` (pinned)** | gramjs архивирован; mtcute живой, браузерный: WSS-транспорт, WASM-крипта (быстрый DH/AES-IGE), IndexedDB-хранилище сессии, `tg.start({phone, code, password})` с колбэками — напрямую маппится на экраны ввода. WASM на Cloud Phone работает (Chromium) |
| Стейт | **zustand** | Минимальный стор для dialogs/chat; redux избыточен |
| UI-кит | нет | Кастомный CSS по гайдлайнам — на 128×160 киты не нужны |
| i18n | нет | Только RU-строки в v1 |
| SVG-иконки | `vite-plugin-svgr` (`?react`) | Как в сэмпле |

Поток данных: `Telegram DCs ⇄ WSS/MTProto ⇄ @mtcute/web ⇄ zustand stores ⇄ React`. Медиа: `tg.downloadAsBuffer` → `Blob` → `URL.createObjectURL` → `<img>/<audio>/<video>`.

**Почему не Bot API / не TDLib:** Bot API не умеет читать чужие чаты и работать от имени пользователя — не подходит. TDLib требует нативной сборки/порта — mtcute закрывает всё нативно в браузере.

---

## 3. Получение api_id и api_hash (обязательно до первого запуска)

1. Открыть <https://my.telegram.org/apps> и войти по номеру телефона (код придёт в Telegram).
2. Выбрать **API development tools** → **Create application**: заполнить *App title* и *Short name* (например, `Pocketgram` / `pocketgram`). Поля URL/platform можно оставить пустыми.
3. Сохранить показанные **api_id** и **api_hash**.
4. Положить в `.env` (см. `.env.example`): `VITE_TG_API_ID`, `VITE_TG_API_HASH`. В CI — GitHub Secrets → подстановка при сборке.

⚠️ api_hash **нельзя отозвать** — не коммитить в репозиторий. В скомпилированном бандле он виден публично — это норма для веб-клиентов Telegram, но hash не должен попадать в git-историю.

---

## 4. Архитектура

```
src/
├── main.tsx                 # createRoot + HashRouter
├── App.tsx                  # auth-gate → Routes (ChatList / Chat / Contacts / Info / Settings / About)
├── index.css                # тема через CSS-переменные (dark/light), --fs для размера шрифта
├── tg/
│   ├── client.ts            # singleton: new TelegramClient(...) + onConnectionState → conn store
│   ├── auth.ts              # signIn(ask) → tg.start({phone,code,password}); signOut
│   ├── dialogs.ts           # iterDialogs → DialogEntry (+readOutbox, draft)
│   ├── messages.ts          # mapMessage (+реакции), история/jumpTo, send/edit/delete/forward/draft, initUpdates
│   ├── peers.ts             # statusText (last-seen), peerInfo (peer вне списка диалогов)
│   ├── notify.ts            # WAV-бип в коде + vibrate по настройкам
│   ├── cache.ts             # IndexedDB pg-media-cache: аватары+медиа, лимит, evict четверти
│   └── media.ts             # mediaKind(), mediaUrl()→blob URL, thumbOf(), MAX_PLAYABLE_BYTES; media.test.ts (vitest)
├── store/
│   ├── auth.ts              # stage: boot|phone|code|password|ready|error + submit/_ask
│   ├── dialogs.ts           # DialogEntry[] {id,title,type,preview,time,unread,pinned,readOutbox,draft}
│   ├── chat.ts              # открытый чат: messages[], readOnly, compose, detached, open/append/prepend
│   ├── conn.ts              # ConnectionState из onConnectionState
│   └── settings.ts          # font/theme/sound/vibrate/dnd/thumbs/muted (persist → localStorage)
├── screens/
│   ├── Auth.tsx             # phone → code → 2FA password (нативный IME)
│   ├── ChatList.tsx         # поиск + список диалогов + OptionsMenu + pick-режим пересылки
│   ├── Chat.tsx             # лента сообщений + Composer + MediaViewer + поиск по чату
│   ├── Contacts.tsx         # контакты Telegram → открыть чат
│   ├── Info.tsx             # профиль user/группы/канала + участники
│   ├── Settings.tsx         # шрифт/тема/звук/вибро/Не беспокоить/миниатюры
│   └── About.tsx
├── components/
│   ├── Header.tsx(.css)     # заголовок + статус; длинные имена — marquee
│   ├── SoftKeyBar.tsx(.css) # LSK(Escape)/CSK(Enter); RSK — событие 'back' → 'end'-действие
│   ├── OptionsMenu.tsx(.css)# полноэкранное меню, открывается через history entry
│   ├── DialogRow.tsx(.css)  # строка чата: аватар, имя, превью, время, unread, pin
│   ├── Bubble.tsx(.css)     # пузырь + медиа-плейсхолдеры + waveform + чипы реакций
│   ├── Composer.tsx(.css)   # поле ввода
│   ├── MediaViewer.tsx(.css)# фото/видео/кружки/голосовые/аудио (history entry)
│   ├── Marquee.tsx(.css)    # бегущая строка, равномерная скорость (~18px/с)
│   ├── Avatar.tsx(.css)     # фото из кэша или круг с инициалом, дет. цвет по id
│   └── Confirm.tsx(.css)    # alert()-замена
├── utils/
│   ├── focus.ts             # FOCUSABLE_CSS_SELECTOR, findFirstFocusable
│   ├── format.ts            # время, длительность, размер, инициал
│   ├── history.ts           # handleBack: 'back'-ивент → 'end' либо дефолт на корне
│   └── features.ts          # navigator.hasFeature() с fallback
└── assets/icons/*.svg       # menu, back, select, play, pin
```

### Авторизация
`Auth.tsx` один раз вызывает `signIn(ask)`: `ask(field)` ставит `stage` в store и возвращает промис; `submit(value)` его резолвит. mtcute сама повторит запрос при неверном коде/пароле (`invalidCodeCallback`). Хранилище `storage:'pocketgram'` → при наличии сессии `tg.start` вернётся сразу, без вопросов (автовход). Ошибки (`RpcError`: PHONE_CODE_INVALID, FLOOD_WAIT_N, SESSION_REVOKED) — текстом под полем, FLOOD_WAIT с секундами.

### Диалоги
`tg.iterDialogs({limit: 100})` → `Dialog[]` → маппинг в `DialogEntry` (тип из `dialog.peer`: user/chat/channel; `unreadCount`, `isPinned`, последнее сообщение → preview+time). Сортировка: pinned ↑, дальше по времени. Обновление: `Обновить` в меню + апдейты (ниже).

### Сообщения
`tg.getHistory(peerId, {limit: 30, offset})` → `Message[]`; ленивая подгрузка при скролле к верху. Маппинг: `msg.isOutgoing → out`, `msg.date → time`, `msg.text` (entities → plain text v1), `msg.media → mediaKind`.

### Updates
`tg.onNewMessage`/`updateNewMessage` → append в открытый чат, bump диалога (наверх, +unread). Пометка прочитанным при открытии чата (`messages.readHistory`). typing-индикатор — только если окажется дёшево по рендерам.

### Медиа-пайплайн
| Тип | mtcute | Рендер |
|---|---|---|
| Фото | `Photo` | thumb в пузыре → Enter → MediaViewer фуллскрин |
| Видео | `Video` (`isRound=false`) | превью + ▶ + `длит. · размер`; Enter → MediaViewer: инлайн (`x-puffin-playsinline`, стриминг растущим blob) или системный плеер — настройка `fsVideo` |
| Кружочек | `Video` (`isRound=true`) | то же, что видео |
| Голосовое | `Voice` (`duration`, `waveform`) | круглая ▶ + волна + длит.; Enter → MediaViewer `<audio controls>` |
| Аудиофайл | `Audio` | строка-элемент → MediaViewer `<audio controls>` |
| Стикер | `Sticker` webp | картинка; tgs/видео-стикеры → `[Стикер]` |
| Прочее | `Document` и пр. | `[Файл · размер]`; «Скачать» через `<a download>` (фича `FileDownload`), >48 МБ — с подтверждением |

**Без MSE видео нельзя стримить по-настоящему** — инлайн-режим эмулирует стриминг: URL пересоздаётся по мере прихода чанков (с restore позиции). В системном режиме (`fsVideo`) файл качается целиком до создания URL — один стабильный src, системный плеер не теряет источник. `<video controls>` не используется нигде: нативные контролы съедают нажатие центра и рисуют градиент на полэкрана — play/pause на наш `Enter`. Лимит `MAX_PLAYABLE_BYTES = 48 МБ` (IndexedDB blob ≤50МБ). MIME у блоба нормализуется по типу медиа (пустой/`octet-stream` → `video/mp4`, `audio/ogg` и т.д.).

---

## 5. Экраны и клавиши

Бюджет QQVGA 128×160: хедер 20px + софтбар 20px + тело ~120px → ~4 строки диалога или ~5–6 пузырей.

### Auth (`stage: phone|code|password|qr`)
- Без хедера (экономия вертикали); метка поля, `<input>` (tel/text/password), кнопка «Продолжить» (`↓` из поля — центр на поле открывает нативный IME, до Enter не доходит), ошибка красным.
- На code-стадии — кнопка «Прислать SMS» (рестарт `start` с `forceSms`; номер кешируется) + подсказка канала доставки (`codeSentCallback`).
- На phone-стадии — «Вход по QR-коду» (`qrCodeHandler` → `stage:'qr'`, QR фокусируемый первым; обход доставки кодов — актуально для аккаунтов < ~6 мес., Telegram молча режет им коды на сторонних api_id). «По номеру» — назад.
- Подсказки управления намерено не выводятся (приватный клиент).

### ChatList (index-роут)
- Без хедера (экономия вертикали). Поле «Поиск…» — локальный фильтр по имени.
- Строки: аватар-круг 20px (инициал, цвет по id), имя 12pt bold, превью 10pt, время, бейдж unread, pin.
- Фокус-зоны (модель YouTube на Cloud Phone): кнопка `🔍` → строки → нижний бар — всё реально фокусируемые элементы, `↑↓` двигают по вертикали, `←→` между кнопками бара. Центр на `🔍` → поле поиска (IME); центр на строке/кнопке — действие. `↓` на кнопке бара — скроллит ленту, фокус не уходит.
- Клавиши: `Enter`/CSK — открыть чат (в pick-режиме `?forward=` — переслать и перейти в целевой), `*` — фильтр «только непрочитанные», `0-9` — T9-jump к первому совпадению (бэклог), LSK — OptionsMenu: *Обновить / Контакты / Настройки / О приложении / Выйти* (выход → Confirm → `auth.logOut` + очистка → Auth), RSK — выход из виджета (`window.close`).
- При отсутствии сети сверху полоска «Нет сети»/«Подключение…» (`onConnectionState`).

### Chat (`/chat/:peerId`)
- Хедер: имя собеседника + статус («канал», у user-диалогов — last-seen «в сети»/«был …», обновляется по `onUserStatusUpdate`). Точка соединения слева при offline/connecting.
- Лента: `in`/`out` пузыри, разделители дат (видны при переходе фокуса на первое сообщение дня), имя отправителя в группах, плашка `↩` у ответов, `изм.` у правок, статусы `⏱`/`✓`/`✓✓` у исходящих (`lastReadOutgoing` + `onHistoryRead`), чипы реакций (read-only), миниатюры (отключаемо), GIF — статично. Пузырь выше экрана: `↑↓` сначала скроллят его внутри (по 48px), потом переносят фокус — любое сообщение читается целиком.
- Композер: `<input placeholder="Сообщение…">` + кнопка `➤`; черновик подхватывается из `dialog.draftMessage` и сохраняется `saveDraft` при выходе; плашка `↩`/`✎` в режиме ответа/правки (Esc — отмена). В read-only каналах композер скрыт.
- Клавиши: `↑↓` фокус по сообщениям (старт с последнего/запомненного) → поле → `➤` → нижний бар; `#` — к последнему сообщению (после прыжка — перезагрузка хвоста); `←→` на пузыре — соседний диалог; `Enter` — фото/видео → MediaViewer, голосовое/аудио → play/stop, текстовый ответ → переход к оригиналу; LSK — меню действий (*Ответить · Цитировать · Переслать · Открыть ссылку · Изменить · Удалить · Поиск · Закреплённое · Информация · Без звука · Прочитано · Скачать*), RSK — назад.
- Поиск в чате (`#search` history entry): поле + «Найти» → `searchMessages` → список результатов → центр → `jumpTo` (история вокруг сообщения, лента помечается `detached`).

### Contacts (`/contacts`)
- `getContacts()` → строки аватар+имя+телефон, фильтр по имени/цифрам, та же фокус-модель, что в списке чатов. Центр → `/chat/:id` (peer вне списка диалогов подтягивается через `peerInfo`).

### Info (`/info/:peerId`)
- `getFullUser`/`getFullChat` → карточка: большой аватар, имя, @username, телефон, статус, тип (канал/группа), участников/подписчиков/в сети, bio-блок; кнопка «Участники» (`canViewParticipants`, со спиннером загрузки) → `getChatMembers` строками аватар+имя+статус. `↑↓` — скролл/кнопка.

### Settings (`/settings`)
- Кнопки-строки: `Шрифт 9–12pt` (`--fs` на :root), `Тема` (`data-theme`), `Звук`, `Вибрация`, `Не беспокоить`, `Миниатюры`, `Видео: инлайн/системное` (`fsVideo`), строка `Соединение`. Persist в localStorage `pg-settings`.

### MediaViewer (оверлей + history entry)
- Фото — `object-fit: contain`; видео/кружок — `<video>` без controls: центр — play/pause, `↑↓` — громкость (`volumeManager`), `x-puffin-playsinline` только в инлайн-режиме; голосовые/аудио — `<audio controls>`. Прогресс загрузки в %, hint-строка с ошибкой `play()`. RSK/Esc — закрыть.

---

## 6. Хранение и приватность

- **Сессия MTProto** — IndexedDB (`storage:'pocketgram'`): шифруется ключом с устройства на стороне CloudMosa; Clear Data → перелогин.
- **Настройки** — localStorage.
- **Медиа-кэш** — IndexedDB `pg-media-cache`: аватары и скачанное медиа по `uniqueFileId`, ленивое открытие БД, evict старой четверти при переполнении, dedup одновременных загрузок; очищается при выходе из аккаунта. blob URL живут до закрытия экрана.
- **Доверие**: MTProto завершается на сервере CloudMosa — сообщения расшифровываются там, как и в любом «облачном браузере». Это надо явно принимать (аналогично использованию вебкафе). Secret chats поэтому невозможны в принципе.

---

## 7. Деплой

- **GitHub Pages**: `.github/workflows/pages.yml` (JamesIves/github-pages-deploy-action@v4 → `dist`). `vite.config`: `base:'./'`, HashRouter. `VITE_TG_API_ID/HASH` — из GitHub Secrets в шаг сборки.
- **CSP**: `<meta http-equiv="Content-Security-Policy">` инжектится только в прод-сборку (`vite.config.ts`): `script-src 'self' 'wasm-unsafe-eval'`, без eval и remote-скриптов; `connect-src` широкий — mtcute ходит по ротирующимся DC-эндпоинтам Telegram по wss. Dev-сервер без CSP (нужен HMR). Если на девайсе пустой экран — первым делом снять meta и перепроверить.
- **⚠️ Приватность**: GitHub Pages для **приватного** репозитория требует платный план (Pro/Team). Варианты:
  1. Публичный репозиторий — api_hash в бандле всё равно публичен, код открытого клиента секретов не содержит. **Рекомендуется.**
  2. Cloudflare Pages / Vercel free — собирают из приватных репо, отдают публичный HTTPS-URL.
- URL виджета публичен в любом случае — **доступ ограничивает IMEI-лист** в Cloud Phone dev-программе (делает пользователь): виджет виден только на зарегистрированных устройствах.
- Регистрация виджета: dev-программа → имя ≤10 символов («Pocketgram» — ровно 10, ок), HTTPS-URL, иконка PNG (512×512, непрозрачная, `public/icon.png` есть; финальную нарисовать позже), IMEI через `*#06#`. Developer mode на телефоне: LSK → Settings → About → LSK ×7.

---

## 8. Лимиты и риски

| # | Риск/лимит | Детали | Митигейшн |
|---|---|---|---|
| 1 | **Дешифровка на сервере CloudMosa** | MTProto-сессия и контент живут в их Chromium | Модель доверия = удалённый браузер; фиксируется в ТЗ; не хранить там 2FA-пароль (вводится каждый раз только при логине) |
| 2 | **IP дата-центра** | Логин с IP CloudMosa (Сингапур/США) → уведомление «вход с нового устройства» из другой страны | Ожидаемо; одноразовое; не паниковать при push |
| 3 | **Нет MSE** | Инлайн-видео — эмуляция стриминга растущим blob URL; системный режим — полная загрузка | Лимит ~48 МБ + fallback на `<a download>` |
| 4 | **Кодеки** | Гарантирован H.264+AAC/MP4; HEVC нет; MKV-контейнер нет | «Формат не поддерживается» + скачивание |
| 5 | **Трафик пользователя** | Видео ≈120 МБ/час QQVGA; анимации тоже жгут | Размер перед проигрыванием; минимум анимаций; статичные превью |
| 6 | **Flood limits** | Telegram rate-limit на auth и getHistory | Backoff из RpcError (`FLOOD_WAIT_N`), подгрузка по 30, без агрессивных поллингов |
| 7 | **playbackRate / volume** | Не работают | Без ускорения голосовых; громкость — `navigator.volumeManager` (бэклог) |
| 8 | **Сикрет-чаты** | Невозможны в веб-клиентах | Не входят в ТЗ |
| 9 | **Звонки** | Нет WebRTC | Не входят в ТЗ |
| 10 | **Эмодзи** | IME их не вводит | Бэклог: кастомный пикер на клавишах 0-9 |
| 11 | **Revoke сессии** | Удалённое завершение сеанса → ошибки API | Ловим auth-ошибки → экран Auth |
| 12 | **api_hash в бандле** | Публичен, не отзывается | Только `.env`/CI-секреты, никогда в git |
| 13 | **Симулятор ≠ девайс** | Нет file upload, микрофона, Volume Manager в симуляторе | Финальная проверка на железе |
| 14 | **Бандл ~1.5 МБ** | На серверном рендере не критично | При желании — tree-shake `@mtcute/core` + ручные чанки |

---

## 9. Тест-план

0. **Юнит-тесты**: `npm test` (vitest, `src/**/*.test.ts` — чистая логика tg/utils).
1. **Chrome DevTools**: responsive 128×160 и 240×320; стрелки/Enter/Escape/`0-9`; прогон всех экранов; `document.title`.
2. **Cloud Phone Simulator** (cloudphone.tech/my/simulator): QVGA+QQVGA; проверить WASM-авторизацию, WS-соединение с Telegram DC, рендер списков. Помнить: нет file upload/volume/mic.
3. **Устройство**: developer mode → IMEI → виджет в конце списка; прогон: логин → список → чат → фото/видео/голосовое → меню → выход/вход (persist сессии).

Критерии приёмки v1: логин по телефону+коду (+2FA); автовход при наличии сессии; список диалогов с превью/unread/поиском; история чата с подгрузкой; отправка текста; фото фуллскрин; видео/кружок проигрывается (≤48 МБ); голосовое играется с waveform; RSK ходит назад корректно; выход из аккаунта с подтверждением.

---

## 10. Вне скоупа v1 (бэклог)

Отправка фото/файлов (`FileUpload`/`ImageUpload`), запись голосовых (`AudioCapture` + MediaRecorder→opus — спорно), эмодзи-пикер, T9-jump по списку, **установка реакций** (`sendReaction` — показ уже есть), live-обновление реакций, typing-индикаторы, tgs-анимации, i18n, QVGA-полировка.
