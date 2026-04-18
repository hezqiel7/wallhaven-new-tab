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
