# Wallhaven New Tab

Extension MV3 para reemplazar la pestaña nueva con wallpapers de Wallhaven.

## Features

- Wallpaper de Wallhaven en nueva pestaña.
- Boton para siguiente wallpaper y boton para descargar.
- Panel de configuracion (`⚙`) con:
  - API key de Wallhaven (opcional)
  - filtros (`q`, categorias, purity, sorting, topRange, resolucion, ratio)
  - duracion de cache en minutos
  - modo de ajuste de imagen y posicion
- Cache local para reducir requests.
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

## API de Wallhaven

Documentacion oficial: https://wallhaven.cc/help/api

## Notas de privacidad

La extension guarda en `localStorage`:

- configuracion (incluyendo API key si la ingresas)
- ultimo wallpaper cacheado
- historial limitado de IDs vistos

No guarda automaticamente archivos de imagen en disco. Solo se descarga cuando usas el boton `↓`.
