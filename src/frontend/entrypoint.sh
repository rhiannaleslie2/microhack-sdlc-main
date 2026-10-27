#!/bin/sh

API_HOST=${API_HOST:-api}
API_PORT=${API_PORT:-3000}
export API_HOST API_PORT
export NGINX_ENVSUBST_FILTER='^(API_HOST|API_PORT)$'

cat > /usr/share/nginx/html/runtime-config.js <<'EOF'
window.RUNTIME_CONFIG = {
  API_URL: window.location.origin
};
EOF

exec /docker-entrypoint.sh nginx -g 'daemon off;'