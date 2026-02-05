#!/bin/bash
# LocalTube - One-step deployment script
set -e

echo "═══════════════════════════════════════════════════"
echo "  LocalTube Deployment"
echo "═══════════════════════════════════════════════════"

# Set vm.max_map_count for Elasticsearch (requires sudo)
echo "Setting vm.max_map_count..."
sudo sysctl -w vm.max_map_count=262144 2>/dev/null || echo "Warning: Could not set vm.max_map_count"

# Build and start
echo "Building and starting services..."
docker compose up -d --build

echo ""
echo "═══════════════════════════════════════════════════"
echo "  Deployment Complete!"
echo "═══════════════════════════════════════════════════"
echo ""
echo "Services:"
echo "  Backend:       http://localhost:8080"
echo "  Elasticsearch: http://localhost:9200"
echo "  Kibana:        http://localhost:5601"
echo "  Prometheus:    http://localhost:9090"
echo "  Grafana:       http://localhost:3000 (admin/admin123)"
echo ""
echo "Logs: docker compose logs -f localtube-backend"