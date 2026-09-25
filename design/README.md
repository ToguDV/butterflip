# Flashcards · Design preview

Preview estático del MVP de Flashcards vestido con **Soft Pop**: un sistema flat,
luminoso y juguetón derivado de la referencia visual del usuario (mock móvil de
flashcards con tarjetas de color sólido y acentos geométricos).

Mobile-first, una sola columna, **sin sidebars ni marco de ventana**. La navegación es
un **tab bar flotante en píldora** (Dashboard · Study · Decks · System) con indicador
por punto. El canvas es un **lavanda-gris muy suave con blobs orgánicos amarillos**
decorativos; los mazos se muestran como **tarjetas de color sólido** (azul maíz,
coral, butter) con punto y mordida geométrica. **Sin degradados, sin blur, sin
glassmorphism y sin sombras en capas**: la profundidad la hace el contraste de color;
la única sombra (una capa, suave) queda para lo que flota.

## Estructura

```
index.html      topbar (marca + tema) · main.doc con las 4 vistas · tabbar · footer
styles.css      tokens Soft Pop (light/dark) + base 390px + breakpoints 480 / 768 / 1024
capture.cjs     capturas headless (mobile 390×844 @3x + desktop 1200×800 @2x)
screenshots/    10 PNG versionados
```

## Estado · implementación en la app

El sistema Soft Pop de este preview **está aplicado en la app**: el renderer lo
replica en `apps/desktop/src/renderer/styles/app.css` (tokens, base, topbar, tab
bar, tiles de mazo, session/studycard, chips y controles). Adaptaciones respecto
del preview:

- Tab bar con 3 tabs (Dashboard · Study · Decks): no hay tab System porque no hay
  pantalla de sistema; "Decks" lleva al dashboard y hace scroll a la sección.
- Sin botón "Sync" en el dashboard: el sync no está conectado a la UI (ver
  AGENTS.md §10.7).
- La acción del tile es "Open" → deck editor (no "Study"); el borrado del mazo
  vive en el page-head del editor, junto a Rename.
- Tipografía sin red: los stacks declaran Poppins/JetBrains Mono primero pero
  resuelven con fuentes del sistema si no están instaladas (la app es
  offline-first; no hay `@import` de Google Fonts).

Si cambiás tokens o componentes en `styles.css`, replicá los cambios en
`app.css` (están duplicados a propósito: el preview no consume código de la app).

- Sin build ni dependencias: abrilo directo en el navegador (`file://`) o serví la
  carpeta con cualquier servidor estático.
- Las 4 vistas son hermanas dentro de `main.doc`: `div.view[data-view-panel]` (app) y
  `section[data-view-panel="design"]` (galería del design system). Ninguna envuelve a
  las demás: no hay ventana anidada.
- Vistas conmutables por hash: `#dashboard`, `#study`, `#deck-editor`, `#design`.
- Toggle **Light / Dark** en el topbar; el tema se persiste en `localStorage` y se
  aplica antes del primer paint.

## Capturas

```bash
node design/capture.cjs        # desde la raíz del repo
```

Genera `screenshots/` con Chromium headless (Playwright):

| archivo                             | viewport                    |
| ----------------------------------- | --------------------------- |
| `01-dashboard-{light,dark}.png`     | 390×844 @3x                 |
| `02-study-{light,dark}.png`         | 390×844 @3x                 |
| `03-deck-editor-{light,dark}.png`   | 390×844 @3x                 |
| `04-design-system-{light,dark}.png` | 390×844 @3x · full page     |
| `05-desktop-{light,dark}.png`       | 1200×800 @2x · dashboard    |

La corrida verifica el contrato mobile-first y falla si no se cumple: 0 px de scroll
horizontal a 390px y todos los controles (`a`, `button`, `input`) de 44px de alto o más.
El conteo final también falla si quedan PNG viejos en `screenshots/`: borralos antes de
capturar.

Reutiliza `playwright-core` de `tools/screenshot/node_modules` (no instala nada en
`apps/desktop`). En sandboxes sin librerías del sistema el script se auto-configura
(`LD_LIBRARY_PATH`, `FONTCONFIG_FILE`, `XDG_CACHE_HOME`); `CHROME_PATH` permite
apuntar a otro binario de Chromium.

## Breakpoints

- **390px (base)** — una columna, controles de 44px, tarjetas con radio 24px, tab bar
  en píldora flotante blanca con margen (12px).
- **480px** — la fila "nuevo mazo" pasa a input + botón.
- **768px** — `.doc` centrado a 800px, métricas en 4 mini-tarjetas, mazos a 2 columnas,
  galería a 2 columnas, densidad compacta (controles de 32–36px).
- **1024px** — `.doc` a 1120px, sesión de estudio en 2 columnas, galería a 3 columnas.

## Lenguaje visual

- **Flat total**: superficies planas (canvas `--canvas`, tarjetas `--screen`, paneles
  `--panel`) sin bordes ni sombras; la jerarquía la hace el contraste de color.
- **Tarjetas de color sólido**: los mazos son tiles azules, coral o butter con radio
  24px, punto y mordida de acento, y píldora de acción en color contrastado.
- **Acentos geométricos**: puntos, cuartos de círculo ("mordidas") y blobs orgánicos
  (`--blob`) siempre detrás del contenido.
- **Sombras mínimas**: `--shadow-float` (una sola capa) solo para tab bar, menús y
  tooltips; el foco se marca con ring, nunca con glow.
- **Espaciado generoso**: grilla de 4px con pasos largos para el layout; las tarjetas
  se respiran con 20–28px de padding y separación explícita entre secciones.

## Tokens

`styles.css` define los tokens semánticos de Soft Pop (`--canvas`, `--screen`,
`--panel`, `--panel-deep`, `--blob`, `--blue`, `--coral`, `--butter`, `--green`,
`--ink`, …) más la escala del heatmap (`--heat-0..4`), spacing (`--space-*`) y radios
(`--radius-xs` 6px · `--radius-sm` 10px · `--radius-md` 14px · `--radius-lg` 18px ·
`--radius-xl` 24px · `--radius-2xl` 28px · `--radius-pill`). Los componentes consumen
solo `var(--token)`; los únicos hex viven en los bloques de tokens y en la tabla de
paleta de la galería (que documenta light y dark lado a lado).
