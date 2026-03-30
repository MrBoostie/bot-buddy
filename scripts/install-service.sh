#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVICE_NAME="bot-buddy"
UNIT_PATH="/etc/systemd/system/${SERVICE_NAME}.service"
RUN_USER="${1:-openclaw}"

sudo tee "$UNIT_PATH" >/dev/null <<UNIT
[Unit]
Description=Bot Buddy service
After=network.target

[Service]
Type=simple
User=${RUN_USER}
WorkingDirectory=${APP_DIR}
Environment=NODE_ENV=production
EnvironmentFile=${APP_DIR}/.env
ExecStart=/usr/bin/env node dist/index.js
Restart=always
RestartSec=3
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ProtectHome=true
ReadWritePaths=${APP_DIR}

[Install]
WantedBy=multi-user.target
UNIT

sudo systemctl daemon-reload
sudo systemctl enable --now "${SERVICE_NAME}"
echo "Installed + started ${SERVICE_NAME}. Check: systemctl status ${SERVICE_NAME}"
