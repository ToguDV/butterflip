# AGENTS.md — Flashcards

Guía para agentes de código (y humanos) que trabajen en este repositorio.
El código, comandos e identificadores están en inglés; este documento y los comentarios
de las herramientas están en español.

## TL;DR para agentes

- App **offline-first**: todo vive en SQLite local (`~/.flashcards/flashcards.db`); el
  servidor solo sincroniza. No agregues llamadas de red al flujo normal de datos.
- El renderer **nunca** habla con SQLite ni con la red directamente: pasa por
  `src/renderer/db/localDb.ts` (IPC) y `src/renderer/sync/syncService.ts`.
- Después de tocar `packages/shared/src/index.ts` hay que rebuildear el paquete
  (`pnpm --filter @flashcards/shared build`); se consume desde `dist/`.
- Antes de dar algo por terminado: compilar server y renderer y correr el smoke manual
  (ver §8). No hay tests, lint ni CI.
- Leer §10 (limitaciones conocidas) antes de "arreglar" algo: varias inconsistencias
  documentadas son deuda consciente del MVP.

## 1. Qué es el proyecto

MVP de aplicación de flashcards con repaso espaciado simple, heatmap de actividad estilo
GitHub y sincronización entre dispositivos.

- **Cliente**: Electron + React + Vite. SQLite local vía `sqlite3` (nativo, en el proceso
  main). Funciona sin internet.
- **Servidor**: Node.js + Express + Prisma + JWT. Punto de sincronización central.
- **Contrato**: esquemas Zod compartidos en `packages/shared`.
- **Estado**: MVP funcional. El motor de sync y la API están implementados, pero el sync
  todavía no está conectado a la UI (ver §10.7).

## 2. Estructura

```
.
├── apps/
│   ├── desktop/                    # App Electron (Linux/Windows/macOS)
│   │   ├── src/main/main.ts        # Ventana, SQLite local y handlers IPC
│   │   ├── src/preload/preload.ts  # contextBridge → window.electronAPI
│   │   ├── src/renderer/           # UI React
│   │   │   ├── App.tsx             # Shell (topbar + tabbar + tema) y Router: /, /deck/:deckId, /study
│   │   │   ├── pages/              # Home (heatmap+decks), DeckEditor, Study
│   │   │   ├── components/         # Heatmap (grilla Soft Pop) e Icon (SVGs inline)
│   │   │   ├── styles/app.css      # Tokens y componentes Soft Pop (replica design/styles.css)
│   │   │   ├── db/localDb.ts       # Única capa de acceso a datos del renderer
│   │   │   ├── srs/engine.ts       # Cálculo de próximo repaso
│   │   │   └── sync/syncService.ts # Cliente de POST /sync
│   │   └── vite.{main,preload,renderer}.config.ts
│   └── server/                     # API Express
│       ├── prisma/schema.prisma    # Modelos (hoy SQLite, ver §10.1)
│       ├── prisma/seed.ts          # Demo user + deck
│       └── src/
│           ├── index.ts            # Monta rutas y /health
│           ├── middleware/auth.ts  # JWT: authMiddleware + signToken
│           └── routes/             # auth, decks, cards, reviews, sync
├── packages/shared/src/index.ts    # Zod schemas + tipos (fuente de verdad DTO)
├── tools/screenshot/               # Harness de capturas headless del renderer real
├── design/                         # Preview estático del design system (Soft Pop); NO es la app
├── docs/screenshots/               # PNG que usa el README
├── docker-compose.yml              # postgres (+ server) para desarrollo
└── package.json                    # Scripts raíz (pnpm workspaces)
```

## 3. Puesta en marcha

Requisitos: Node 20+, pnpm 9+, Docker (solo si vas a usar Postgres; hoy no hace falta).

```bash
pnpm install
pnpm --filter @flashcards/shared build   # obligatorio: server/desktop importan dist/

# DB del servidor (usa apps/server/.env → sqlite file:./dev.db)
pnpm db:generate
pnpm db:migrate
pnpm db:seed                             # crea demo@example.com / password

pnpm dev:server                          # http://localhost:4000

# En otra terminal (primera vez o tras cambios de UI):
pnpm --filter desktop build:renderer
pnpm dev:desktop
```

Credenciales demo: `demo@example.com` / `password`.

Variables de entorno (copiar desde los `.env.example`):

| App     | Variable       | Default / valor actual                          |
| ------- | -------------- | ----------------------------------------------- |
| server  | `DATABASE_URL` | `.env.example`: Postgres · `.env`: `file:./dev.db` |
| server  | `JWT_SECRET`   | `change-me-in-production` (fallback: `dev-secret-change-me`) |
| server  | `PORT`         | `4000`                                          |
| desktop | `VITE_API_URL` | `http://localhost:4000`                         |

Puertos: server `4000`, Vite dev `5173`, Postgres (compose) `5432`.

## 4. Comandos

Desde la raíz:

| Comando              | Qué hace                                              |
| -------------------- | ----------------------------------------------------- |
| `pnpm dev:server`    | `tsx watch` del server en :4000                       |
| `pnpm dev:desktop`   | Build de main+preload, Vite dev y Electron            |
| `pnpm build:server`  | `tsc` → `apps/server/dist`                            |
| `pnpm build:desktop` | Build completo + `electron-builder` → `apps/desktop/release/` |
| `pnpm db:generate`   | `prisma generate`                                     |
| `pnpm db:migrate`    | `prisma migrate dev`                                  |
| `pnpm db:seed`       | Seed demo                                             |

Por paquete:

```bash
pnpm --filter @flashcards/shared build        # tsc → dist (necesario tras editar shared)
pnpm --filter desktop build:renderer          # solo UI → dist/renderer (rápido)
pnpm --filter desktop build:main              # solo proceso main
pnpm --filter desktop build:preload           # solo preload
```

## 5. Arquitectura

### 5.1 Proceso main (`apps/desktop/src/main/main.ts`)

- Crea `~/.flashcards/flashcards.db` y el esquema (`CREATE TABLE IF NOT EXISTS`) al
  arrancar. No hay migraciones locales: el esquema se define ahí.
- Registra los handlers IPC `db:exec`, `db:get`, `db:all`. `db:exec` decide entre
  `all()` y `run()` mirando si el SQL empieza con `select`.
- Carga `VITE_DEV_SERVER_URL` si existe; si no, `dist/renderer/index.html`.

### 5.2 Preload y renderer

- `preload.ts` expone `window.electronAPI` (`dbExec`/`dbGet`/`dbAll`) con
  `contextIsolation: true` y sin `nodeIntegration`.
- `db/localDb.ts` es la única puerta a los datos desde React: helpers tipados
  (`createDeck`, `getDueCards`, `addReviewLog`, `getSyncMeta`, …).
- UI con el design system **Soft Pop**: CSS global en `styles/app.css`
  (importado por `main.tsx`), sin librería de componentes ni CSS framework. Los
  estilos inline quedan solo para casos puntuales (color de monograma y de
  botones de rate vía la variable `--c`). `App.tsx` monta el shell: topbar con
  marca y toggle Light/Dark (persistido en `localStorage`, clave
  `flashcards-theme`, aplicado antes del primer paint desde `index.html`) y tab
  bar flotante Dashboard · Study · Decks. Rutas: `/` (Home: heatmap + decks),
  `/deck/:deckId` (DeckEditor), `/study` (Study).

**Checklist para agregar una operación de datos local:**

1. `main.ts` — solo si cambia el esquema (tabla/columna).
2. `preload.ts` — solo si hace falta un canal IPC nuevo.
3. `renderer/types/electron.d.ts` — tipar la API expuesta.
4. `renderer/db/localDb.ts` — agregar el helper tipado.
5. Componente/página que lo consume.

No llames a `window.electronAPI` directo desde componentes.

### 5.3 SRS (`renderer/srs/engine.ts`)

- Ratings: `0=Again, 1=Hard, 2=Good, 3=Easy`.
- `rating >= 2` sube un nivel de intervalo; `0/1` baja uno. Intervalos fijos:
  `[1, 3, 7, 14, 30, 60, 120, 240]` días.
- `easeFactor` se persiste (default 2.5) pero **no se usa todavía**; no hay SM-2.

### 5.4 Sync (`renderer/sync/syncService.ts` + `server/src/routes/sync.ts`)

1. El cliente arma `SyncRequest` con **todo** su estado (decks, cards, reviewLogs),
   `deviceId` y el `lastSyncedAt` guardado en la tabla `syncMeta` (no hay delta de subida).
2. El servidor valida con `SyncRequestSchema`, hace upsert last-write-wins forzando el
   `userId` del token (nunca confía en el body) y registra un `SyncCheckpoint` por
   `(userId, deviceId)`.
3. Devuelve decks/cards con `updatedAt > lastSyncedAt` y reviewLogs con
   `createdAt > lastSyncedAt`, más `serverTime`.
4. El cliente aplica con `INSERT OR REPLACE` y guarda `serverTime` como nuevo
   `lastSyncedAt`.

Los borrados **no** se sincronizan (ver §10.4).

### 5.5 API del servidor

Auth: `Authorization: Bearer <jwt>`, JWT de 7 días, passwords con bcrypt (10 rondas).
Errores: `res.status(4xx).json({ error })`.

| Método | Ruta                  | Auth | Notas                                              |
| ------ | --------------------- | ---- | -------------------------------------------------- |
| GET    | `/health`             | no   | `{ ok: true }`                                      |
| POST   | `/auth/register`      | no   | `email`, `password` (≥6), `name?` → `{ token, user }` |
| POST   | `/auth/login`         | no   | `email`, `password` → `{ token, user }`             |
| GET    | `/decks`              | sí   | Incluye `_count.cards`                              |
| POST   | `/decks`              | sí   | `{ name, description? }`                            |
| PUT    | `/decks/:id`          | sí   | Solo decks del usuario                              |
| DELETE | `/decks/:id`          | sí   | Cascada a cards                                     |
| GET    | `/cards/deck/:deckId` | sí   |                                                     |
| GET    | `/cards/due`          | sí   | `nextReviewAt <= now` o `null`                      |
| POST   | `/cards`              | sí   | `front`, `back`, `deckId` + campos SRS opcionales   |
| PUT    | `/cards/:id`          | sí   |                                                     |
| DELETE | `/cards/:id`          | sí   |                                                     |
| POST   | `/reviews`            | sí   | `{ cardId, rating 0-3 }`; actualiza SRS en server   |
| POST   | `/sync`               | sí   | `SyncRequest` → `SyncResponse`                      |

## 6. Modelo de datos

Prisma (`apps/server/prisma/schema.prisma`): `User`, `Deck`, `Card`, `ReviewLog`,
`SyncCheckpoint`. `Card` guarda `intervalDays`, `repetitions`, `easeFactor`,
`nextReviewAt`; los borrados en cascada caen de `Deck`/`User`.

El SQLite local replica `decks`, `cards`, `reviewLogs` + `syncMeta` (key/value).
El esquema local está duplicado en `main.ts` y en `tools/screenshot/seed.js`: si agregás
una columna, actualizá ambos (y `schema.prisma` para el server).

## 7. Convenciones

- TypeScript strict en los tres paquetes. Evitá `any`; los DTO se tipan desde
  `@flashcards/shared`.
- Los esquemas Zod de `packages/shared` son la fuente de verdad de los DTO. En el server
  se valida con el patrón `Schema.safeParse(req.body)` → `400` con `error.format()`.
- `packages/shared` se consume desde `dist/`: después de editarlo, rebuildear.
- Textos de UI en inglés; comentarios de herramientas/scripts en español.
- El servidor jamás confía en `userId` del body: siempre del token.
- Si agregás un campo a un modelo, hay que tocar: `schema.prisma` + migración, esquema Zod
  en shared, `CREATE TABLE` en `main.ts`, `seed.js` del harness y las columnas explícitas
  de los `INSERT OR REPLACE` / upserts de `syncService.ts` y `routes/sync.ts`.

## 8. Verificación

No hay tests, lint ni CI. Lo mínimo antes de entregar:

```bash
# Compilación
pnpm --filter @flashcards/shared build
pnpm build:server                              # tsc
pnpm --filter desktop build:main
pnpm --filter desktop build:preload
pnpm --filter desktop build:renderer

# Smoke del server
pnpm dev:server
curl http://localhost:4000/health              # {"ok":true}

# Smoke manual de la app: crear mazo → agregar tarjeta → estudiar 4 ratings → heatmap
```

Capturas (opcionales, requieren Playwright; ver READMEs de cada harness):

```bash
# Renderer real headless (UI + datos vía shim de sql.js)
pnpm --filter desktop build:renderer
cd tools/screenshot && npm install --no-save playwright-core sql.js && npm run shots

# Preview de diseño estático (valida contrato mobile-first)
node design/capture.cjs
```

`design/capture.cjs` falla si hay scroll horizontal a 390px, si algún control mide
menos de 44px o si quedan PNG viejos en `design/screenshots/`.

## 9. Diseño y capturas

- `design/` es un **preview estático** (HTML/CSS/JS sin build) vestido con Soft Pop.
  No consume código de la app ni el paquete shared; los cambios ahí no afectan la app.
  Vistas por hash: `#dashboard`, `#study`, `#deck-editor`, `#design`; toggle Light/Dark.
- El sistema Soft Pop **está implementado en la app** vía
  `renderer/styles/app.css`. Los tokens y componentes viven **duplicados** ahí:
  si cambiás `design/styles.css`, replicá en `app.css` (ver
  `design/README.md` § Estado, que documenta las adaptaciones: 3 tabs, sin botón
  Sync, tile "Open" y fuentes sin red).
- `tools/screenshot/` captura el **renderer real** sin display, shimmeando
  `window.electronAPI` con sql.js sobre un SQLite sembrado (`shot.js`), y también
  sirve ese mismo stage para previsualizar en un navegador común (`serve.js`,
  ideal detrás de un quick tunnel de Cloudflare). Tras cambiar UI:
  `build:renderer` + `node prepare.js` antes de capturar o servir.
- `docs/screenshots/` son los PNG que referencia el README; regeneralos con el
  harness después de cambios visuales.

## 10. Limitaciones conocidas y trampas

1. **Postgres documentado vs SQLite real.** README, `docker-compose.yml` y
   `.env.example` asumen PostgreSQL, pero `schema.prisma` tiene `provider = "sqlite"` y
   `apps/server/.env` usa `file:./dev.db`. Levantar el servicio `server` de compose falla
   (URL `postgresql://` con cliente sqlite). Para volver a Postgres: cambiar provider y
   `migration_lock.toml`, regenerar migraciones, `pnpm db:generate`.
2. **`pnpm dev:desktop` no define `VITE_DEV_SERVER_URL`.** El main carga
   `dist/renderer/index.html` (build viejo) y el dev server de Vite (5173) queda sin uso.
   Para ver cambios de UI: `pnpm --filter desktop build:renderer`, o exportar
   `VITE_DEV_SERVER_URL=http://localhost:5173` antes de lanzar `electron .`.
3. **`prisma/seed.ts` no es idempotente.** Crea `demo@example.com` sin chequear; correrlo
   dos veces falla por unique. Reset: borrar `apps/server/prisma/dev.db` y
   `pnpm db:migrate && pnpm db:seed`.
4. **El sync no propaga borrados.** `deleteDeck`/`deleteCard` solo tocan SQLite local; el
   servidor nunca borra y reinyecta los registros en el próximo sync. Sincronizar borrados
   requiere tombstones y cambios en el protocolo.
5. **Tablas de intervalos divergentes.** Desktop: `[1,3,7,14,30,60,120,240]`; server
   (`routes/reviews.ts`): `[1,3,7,14,30,60,120]`. El cálculo del servidor es un fallback;
   si cambiás uno, cambiá el otro (o unificalos en shared).
6. **`easeFactor` sin uso.** Se guarda pero el cálculo ignora el factor de facilidad.
7. **El sync no está conectado a la UI.** `syncWithServer()` existe pero nadie lo llama;
   no hay login ni manejo de token/deviceId en el renderer.
8. **README desactualizado en detalles**: dice `better-sqlite3` pero la dependencia real es
   `sqlite3`. Además `electron-builder` usa `npmRebuild: false`: verificar el empaquetado
   del módulo nativo antes de confiar en los instaladores.
9. **Sin tests, lint ni CI.** El repo está versionado en GitHub (ver remote
   `origin`); el `.gitignore` cubre `node_modules`, `dist`, `release`, `.env`,
   `*.db` y el staging de `tools/screenshot/` (`out/`, `renderer/`).
10. **Nada de red en el flujo local.** El heatmap, el estudio y el CRUD leen/escriben solo
    SQLite; si algo necesita red, va por `syncService.ts`, no en componentes.

## 11. Roadmap (del README)

- [ ] SM-2 real en lugar de intervalos fijos
- [ ] Adjuntos de imagen/audio
- [x] Dark mode / theming (implementado con el toggle Light/Dark de Soft Pop;
  el preview de `design/` ya lo exploraba)
- [ ] Notificaciones y recordatorios diarios
- [ ] Import/export de mazos Anki
- [ ] Build Android vía Capacitor
- [ ] Sync en tiempo real con WebSockets
