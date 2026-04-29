#!/bin/bash

# FinPJ Evolution - Backup Script
# Criado: 2026-04-25
# Propósito: Backup completo antes de evolução

set -e

BACKUP_DIR="./backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_NAME="finpj_backup_${TIMESTAMP}"

echo "🚀 Iniciando backup FinPJ Evolution..."

# Criar diretório de backup
mkdir -p "${BACKUP_DIR}"

# Backup do código fonte
echo "📦 Fazendo backup do código fonte..."
tar -czf "${BACKUP_DIR}/${BACKUP_NAME}_code.tar.gz" \
    --exclude=node_modules \
    --exclude=.git \
    --exclude=backups \
    --exclude=dist \
    --exclude=build \
    .

# Backup do package.json e package-lock.json
echo "📋 Fazendo backup das dependências..."
cp package.json "${BACKUP_DIR}/${BACKUP_NAME}_package.json"
cp package-lock.json "${BACKUP_DIR}/${BACKUP_NAME}_package-lock.json"

# Backup das variáveis de ambiente (se existir)
if [ -f .env ]; then
    echo "🔐 Fazendo backup das variáveis de ambiente..."
    cp .env "${BACKUP_DIR}/${BACKUP_NAME}_env"
fi

# Backup do estado atual dos dados (se houver)
if [ -d "data" ]; then
    echo "💾 Fazendo backup dos dados..."
    tar -czf "${BACKUP_DIR}/${BACKUP_NAME}_data.tar.gz" data/
fi

# Criar arquivo de metadados do backup
cat > "${BACKUP_DIR}/${BACKUP_NAME}_metadata.json" << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "branch": "$(git branch --show-current)",
  "commit": "$(git rev-parse HEAD)",
  "version": "1.0.0",
  "description": "Backup completo antes da evolução FinPJ",
  "files": [
    "${BACKUP_NAME}_code.tar.gz",
    "${BACKUP_NAME}_package.json",
    "${BACKUP_NAME}_package-lock.json",
    "${BACKUP_NAME}_env",
    "${BACKUP_NAME}_data.tar.gz",
    "${BACKUP_NAME}_metadata.json"
  ]
}
EOF

# Compactar tudo em um arquivo único
echo "🗜️ Compactando backup completo..."
tar -czf "${BACKUP_DIR}/${BACKUP_NAME}_complete.tar.gz" \
    "${BACKUP_DIR}/${BACKUP_NAME}_code.tar.gz" \
    "${BACKUP_DIR}/${BACKUP_NAME}_package.json" \
    "${BACKUP_DIR}/${BACKUP_NAME}_package-lock.json" \
    "${BACKUP_DIR}/${BACKUP_NAME}_env" 2>/dev/null || true \
    "${BACKUP_DIR}/${BACKUP_NAME}_data.tar.gz" 2>/dev/null || true \
    "${BACKUP_DIR}/${BACKUP_NAME}_metadata.json"

# Limpar arquivos individuais
rm -f "${BACKUP_DIR}/${BACKUP_NAME}_code.tar.gz"
rm -f "${BACKUP_DIR}/${BACKUP_NAME}_package.json"
rm -f "${BACKUP_DIR}/${BACKUP_NAME}_package-lock.json"
rm -f "${BACKUP_DIR}/${BACKUP_NAME}_env" 2>/dev/null || true
rm -f "${BACKUP_DIR}/${BACKUP_NAME}_data.tar.gz" 2>/dev/null || true
rm -f "${BACKUP_DIR}/${BACKUP_NAME}_metadata.json"

# Criar script de restore
cat > "${BACKUP_DIR}/restore.sh" << EOF
#!/bin/bash

# FinPJ Evolution - Restore Script
# Uso: ./restore.sh finpj_backup_YYYYMMDD_HHMMSS_complete.tar.gz

set -e

BACKUP_FILE="\$1"

if [ -z "\$BACKUP_FILE" ]; then
    echo "❌ Uso: \$0 <backup_file.tar.gz>"
    exit 1
fi

if [ ! -f "\$BACKUP_FILE" ]; then
    echo "❌ Arquivo de backup não encontrado: \$BACKUP_FILE"
    exit 1
fi

echo "🔄 Iniciando restore do FinPJ..."

# Criar diretório temporário
TEMP_DIR="./temp_restore"
mkdir -p "\$TEMP_DIR"

# Extrair backup
tar -xzf "\$BACKUP_FILE" -C "\$TEMP_DIR"

# Restaurar código fonte
echo "📦 Restaurando código fonte..."
tar -xzf "\$TEMP_DIR"/*_code.tar.gz -C ./

# Restaurar package.json
cp "\$TEMP_DIR"/*_package.json ./
cp "\$TEMP_DIR"/*_package-lock.json ./

# Restaurar variáveis de ambiente (se existir)
if [ -f "\$TEMP_DIR"/*_env ]; then
    echo "🔐 Restaurando variáveis de ambiente..."
    cp "\$TEMP_DIR"/*_env ./.env
fi

# Restaurar dados (se existir)
if [ -f "\$TEMP_DIR"/*_data.tar.gz ]; then
    echo "💾 Restaurando dados..."
    tar -xzf "\$TEMP_DIR"/*_data.tar.gz -C ./
fi

# Instalar dependências
echo "📦 Reinstalando dependências..."
npm install

# Limpar diretório temporário
rm -rf "\$TEMP_DIR"

echo "✅ Restore concluído com sucesso!"
echo "🔄 Execute 'git checkout main' para voltar para a branch principal"
EOF

chmod +x "${BACKUP_DIR}/restore.sh"

echo "✅ Backup concluído com sucesso!"
echo "📁 Arquivo: ${BACKUP_DIR}/${BACKUP_NAME}_complete.tar.gz"
echo "🔄 Para restore: ./backups/restore.sh ${BACKUP_NAME}_complete.tar.gz"
echo "📊 Tamanho: $(du -h "${BACKUP_DIR}/${BACKUP_NAME}_complete.tar.gz" | cut -f1)"
