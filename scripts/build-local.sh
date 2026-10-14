#!/usr/bin/env bash
# Build the image, save it to ./images/, and optionally load it into a local cluster.
#
#   ./scripts/build-local.sh <version> [kind|k3d|minikube|k3s|containerd|none] [cluster-name]
#
# Examples:
#   ./scripts/build-local.sh 0.1.0 kind dev
#   ./scripts/build-local.sh 0.1.1 k3s
#
# The image is tagged registry.local/dashr/dashr-nova:<version>. That name is
# never pulled: the deployment uses pullPolicy Never, so the image must already
# be on the node. Use a new version for every build; Kubernetes won't restart
# pods for a tag it has already deployed.
#
# Behind a TLS-inspecting proxy, set CORP_CA_FILE to its root CA (PEM) so npm
# can reach the registry. It is passed as a build secret, not baked in.
set -euo pipefail

VERSION="${1:?usage: build-local.sh <version> [kind|k3d|minikube|k3s|containerd|none] [cluster-name]}"
TARGET="${2:-none}"
CLUSTER="${3:-}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
IMAGE="${IMAGE_REPO:-registry.local/dashr/dashr-nova}:${VERSION}"
TAR="$ROOT/images/dashr-nova-${VERSION}.tar"

if [ "$VERSION" = "latest" ]; then
  echo "error: use an explicit version, not 'latest'" >&2
  exit 1
fi

mkdir -p "$ROOT/images"
SECRET_ARGS=()
if [ -n "${CORP_CA_FILE:-}" ]; then
  SECRET_ARGS=(--secret "id=corp_ca,src=$CORP_CA_FILE")
fi
docker build "${SECRET_ARGS[@]+"${SECRET_ARGS[@]}"}" --build-arg APP_VERSION="$VERSION" -t "$IMAGE" "$ROOT"
docker save -o "$TAR" "$IMAGE"
echo "Saved $IMAGE to $TAR"

case "$TARGET" in
  kind)       kind load image-archive "$TAR" ${CLUSTER:+--name "$CLUSTER"} ;;
  k3d)        k3d image import "$TAR" ${CLUSTER:+-c "$CLUSTER"} ;;
  minikube)   minikube image load "$TAR" ${CLUSTER:+-p "$CLUSTER"} ;;
  k3s)        sudo k3s ctr images import "$TAR" ;;
  containerd) sudo ctr -n k8s.io images import "$TAR" ;;
  none)       echo "Not loading into a cluster (target: none)" ;;
  *)          echo "error: unknown target '$TARGET'" >&2; exit 1 ;;
esac

if [ "$TARGET" = "k3s" ] || [ "$TARGET" = "containerd" ]; then
  echo "Note: on multi-node clusters, import $TAR on every node that can run the pod."
fi
echo "Next: set image.tag: \"$VERSION\" in dashr-nova-deploy/overlays/local/helmrelease-patch.yaml and push."
