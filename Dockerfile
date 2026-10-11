# Serves the static app. Build: docker build -t spanish .   Run: docker run -p 8080:80 spanish
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html style.css app.js sw.js manifest.webmanifest icon.svg /usr/share/nginx/html/
COPY data /usr/share/nginx/html/data
COPY audio /usr/share/nginx/html/audio
