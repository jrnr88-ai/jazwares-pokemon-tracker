[README.md](https://github.com/user-attachments/files/30318132/README.md)
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

Para sincronizacion real entre computadora y celular, conecta la app a una base de datos gratuita como Supabase.
