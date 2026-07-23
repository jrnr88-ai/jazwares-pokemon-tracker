# Jazwares Pokemon Tracker

Checklist personal para dar seguimiento a una coleccion de figuras Pokemon de Jazwares.

## Publicar en GitHub Pages

1. Crea un repositorio publico en GitHub, por ejemplo `jazwares-pokemon-tracker`.
2. Sube todos los archivos de esta carpeta al repositorio:
   - `index.html`
   - `styles.css`
   - `app.js`
   - `data.js`
   - `.nojekyll`
3. En GitHub entra a `Settings > Pages`.
4. En `Build and deployment`, elige:
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/root`
5. Guarda. La pagina quedara en:
   `https://TU_USUARIO.github.io/jazwares-pokemon-tracker/`

## Uso

El progreso se guarda en el navegador con `localStorage`. Para moverlo entre dispositivos usa los botones:

- Descargar: exporta tu progreso como JSON.
- Subir: importa ese JSON en otro dispositivo.
- Reset: restaura el estado base importado desde Excel.

## Sincronizacion con Supabase

1. Crea un proyecto gratis en Supabase.
2. En `SQL Editor`, pega y ejecuta el contenido de `supabase-schema.sql`.
3. En `Authentication > URL Configuration`, agrega como Site URL:
   `https://jrnr88-ai.github.io/jazwares-pokemon-tracker/`
4. En `Project Settings > API`, copia:
   - Project URL
   - anon public key
5. Edita `config.js` y reemplaza:
   - `TU-PROYECTO.supabase.co`
   - `TU-ANON-KEY`
6. Sube `config.js`, `app.js`, `index.html`, `styles.css` y `supabase-schema.sql` actualizados a GitHub.

Cuando abras la pagina, usa el boton `Nube local`, escribe tu email y entra con el enlace que llega al correo. El progreso se sincroniza por usuario entre celular y computadora.
