# Guía de Despliegue - Campeonato Kostkas

Para instalar la aplicación en tu servidor bajo la ruta `https://www.unaiz.net/kostkas`, sigue estos pasos:

## 1. Preparar el Servidor
Asegúrate de tener acceso a tu servidor (vía FTP, SFTP o Panel de Control como cPanel/Plesk).
1.  Navega a la carpeta pública de tu web (usualmente `public_html` o `www`).
2.  Crea una nueva carpeta llamada `kostkas`.

## 2. Subir los Archivos
Sube **todo el contenido** de tu carpeta local de proyecto a la nueva carpeta `kostkas` en el servidor.
La estructura final en el servidor debe quedar así:

```
/public_html/kostkas/
├── index.html
├── llms.txt
├── css/
│   └── style.css
├── js/
│   └── app.js
├── img/
│   ├── favicon.png
│   ├── og-image.png
└── data/
    └── Campeonato Kostkas 2025_2026.xlsx
```

## 3. Verificar Permisos
Asegúrate de que los archivos tengan permisos de lectura para el público (usualmente `644` para archivos y `755` para carpetas).

## 4. Actualizar Datos
Para actualizar las estadísticas en el futuro, simplemente reemplaza el archivo `data/Campeonato Kostkas 2025_2026.xlsx` en el servidor con la versión más reciente.
El código está diseñado para detectar cambios y evitar que el navegador use una versión antigua (cache busting).
