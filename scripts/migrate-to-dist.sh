#!/bin/bash
# Migration script: export/ → dist/
# This script migrates existing PDFs from export/ to dist/

set -e  # Exit on error

echo "🚀 Starting migration from export/ to dist/"
echo "==========================================="
echo ""

# Create dist structure
echo "📁 Creating dist/ structure..."
mkdir -p dist/web dist/pdf

# Migrate main PDFs
if [ -d "export/web/pdf" ] && [ "$(ls -A export/web/pdf/*.pdf 2>/dev/null)" ]; then
  echo "📋 Migrating main PDFs..."
  cp -v export/web/pdf/*.pdf dist/pdf/
else
  echo "⚠️  No main PDFs found in export/web/pdf/"
fi

# Migrate 360 branch PDFs
if [ -d "export/web/360/pdf" ] && [ "$(ls -A export/web/360/pdf/*.pdf 2>/dev/null)" ]; then
  echo "📋 Migrating 360 branch PDFs..."
  mkdir -p dist/pdf/360
  cp -v export/web/360/pdf/*.pdf dist/pdf/360/
else
  echo "⚠️  No 360 PDFs found in export/web/360/pdf/"
fi

echo ""
echo "✅ Migration completed!"
echo ""
echo "📊 Summary:"
echo "   dist/pdf/:"
ls -lh dist/pdf/*.pdf 2>/dev/null || echo "   (no files)"
echo ""
if [ -d "dist/pdf/360" ]; then
  echo "   dist/pdf/360/:"
  ls -lh dist/pdf/360/*.pdf 2>/dev/null || echo "   (no files)"
  echo ""
fi

echo "🔍 Next steps:"
echo "1. Review the migrated files above"
echo "2. Test the build: npm run build"
echo "3. Add PDFs to Git: git add dist/pdf/"
echo "4. Remove old export/: git rm -rf export/"
echo "5. Commit: git commit -m 'Migrate to dist/ structure'"
