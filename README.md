# Wallhaven New Tab

Extension MV3 para reemplazar la pestaña nueva con wallpapers de Wallhaven.

## Features

- Wallpaper de Wallhaven en nueva pestaña.
- Boton para siguiente wallpaper y boton para descargar.
- Panel de configuracion (`⚙`) con:
  - API key de Wallhaven (opcional)
  - filtros (`q`, categorias, purity, sorting, topRange, resolucion, ratio)
  - duracion de cache en minutos
  - modo de ajuste de imagen (`Ajuste con recorte`, `Ajuste sin recorte`, `Original`) y posicion
- Indicador de resultados estimados con comprobacion automatica (debounce) y color segun calidad del pool.
- Soporte de busqueda OR por comas en `q` (ej: `jujutsu kaisen, naruto, bleach`).
- Mensaje de estado cuando no hay resultados para la busqueda actual.
- Favoritos discretos en la esquina superior izquierda (`★`): menu hover con soporte de carpetas y subcarpetas.
- Cache local para reducir requests.
- Reserva de 1 wallpaper precargado en cola para cambios mas rapidos.
- Transicion suave entre wallpapers.
- Evita repetidos recientes con historial local de IDs.

## Instalacion local (Brave/Chrome)

1. Abre `brave://extensions` o `chrome://extensions`.
2. Activa modo desarrollador.
3. Click en **Load unpacked**.
4. Selecciona esta carpeta.

### Guia paso a paso para principiantes

Si nunca instalaste una extension manualmente, haz esto:

1. Descarga este proyecto como ZIP desde GitHub (**Code > Download ZIP**).
2. Descomprime el ZIP en una carpeta facil de encontrar (por ejemplo `Documentos/wallhaven-new-tab`).
3. Abre Brave o Chrome y entra a:
   - Brave: `brave://extensions`
   - Chrome: `chrome://extensions`
4. Activa el interruptor **Modo desarrollador** (arriba a la derecha).
5. Pulsa **Cargar descomprimida** / **Load unpacked**.
6. Selecciona la carpeta donde estan `manifest.json`, `newtab.html`, `newtab.js` y `newtab.css`.
7. Abre una pestaña nueva para comprobar que funciona.

### Si no aparece o no funciona

- Asegurate de seleccionar la carpeta correcta (la que contiene `manifest.json` en la raiz).
- Pulsa **Recargar** en la tarjeta de la extension dentro de `brave://extensions` o `chrome://extensions`.
- Cierra y vuelve a abrir una pestaña nueva.

## Uso

- `↻`: cargar wallpaper nuevo.
- `↓`: descargar wallpaper actual.
- `⚙`: abrir configuracion.
- `★`: abrir menu de favoritos (hover) con submenus de carpetas.

## Como usar `q` correctamente

El campo `q` usa la misma sintaxis de busqueda de Wallhaven API v1.

Ademas, esta extension soporta OR por comas:

- `naruto, one piece, bleach` -> interpreta cada bloque como una busqueda separada y mezcla resultados.
- Se aplica `trim` automatico por bloque.

Patrones soportados:

- `tagname`: busca por tag/keyword.
- `-tagname`: excluye un tag/keyword.
- `+tag1 +tag2`: ambos tags son obligatorios.
- `+tag1 -tag2`: incluye `tag1` y excluye `tag2`.
- `@username`: wallpapers subidos por un usuario.
- `id:123`: busqueda exacta por ID de tag (no se combina con otros terminos).
- `type:jpg` o `type:png`: filtra por tipo de archivo.
- `like:abc123`: busca wallpapers similares al wallpaper con ese ID.

Ejemplos utiles:

- `landscape -people -text -logo`
- `+mountains +lake -anime`
- `@wallpaperuser`
- `type:jpg landscape forest`
- `like:94x38z`

Tip: para resultados consistentes, combina `q` con filtros de panel (categorias, purity, sorting, topRange, resolucion y ratio).

### Sugerencias para mejores resultados

- Evita filtros demasiado estrictos si quieres mas variedad.
- Usa el indicador `Resultados estimados` del panel:
  - rojo: pool muy bajo/sin resultados
  - naranja/amarillo: pool medio
  - verde: buen pool

## API de Wallhaven

Documentacion oficial: https://wallhaven.cc/help/api

## Notas de privacidad

La extension guarda en `localStorage`:

- configuracion (incluyendo API key si la ingresas)
- ultimo wallpaper cacheado
- historial limitado de IDs vistos
- estado de busqueda y metadatos de prefetch

No guarda automaticamente archivos de imagen en disco. Solo se descarga cuando usas el boton `↓`.
