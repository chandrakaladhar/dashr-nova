#!/usr/bin/env bash
# Build the image and optionally load it into a local cluster. All targets but
# docker-desktop also save it to ./images/.
#
#   ./scripts/build-local.sh <version> [docker-desktop|kind|k3d|minikube|k3s|containerd|none] [cluster-name]
#
# Examples:
#   ./scripts/build-local.sh 0.1.0 docker-desktop
#   ./scripts/build-local.sh 0.1.0 kind dev
#   ./scripts/build-local.sh 0.1.1 k3s
#
# docker-desktop: Docker Desktop's Kubernetes can pull images from the local
# Docker image store, but pullPolicy Never never asks. A throwaway pod with
# pullPolicy IfNotPresent copies the image onto the node first. [cluster-name]
# is the kubectl context (default: docker-desktop).
#
# The image is tagged registry.local/dashr/dashr-nova:<version>. That name is
# never pulled: the deployment uses pullPolicy Never, so the image must already
# be on the node. Use a new version for every build; Kubernetes won't restart
# pods for a tag it has already deployed.
#
# Behind a TLS-inspecting proxy, set CORP_CA_FILE to its root CA (PEM) so npm
# can reach the registry. It is passed as a build secret, not baked in.
set -euo pipefail

VERSION="${1:?usage: build-local.sh <version> [docker-desktop|kind|k3d|minikube|k3s|containerd|none] [cluster-name]}"
TARGET="${2:-none}"
CLUSTER="${3:-}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
IMAGE="${IMAGE_REPO:-registry.local/dashr/dashr-nova}:${VERSION}"
TAR="$ROOT/images/dashr-nova-${VERSION}.tar"

if [ "$VERSION" = "latest" ]; then
  echo "error: use an explicit version, not 'latest'" >&2
  exit 1
fi

SECRET_ARGS=()
if [ -n "${CORP_CA_FILE:-}" ]; then
  SECRET_ARGS=(--secret "id=corp_ca,src=$CORP_CA_FILE")
fi
docker build "${SECRET_ARGS[@]+"${SECRET_ARGS[@]}"}" --build-arg APP_VERSION="$VERSION" -t "$IMAGE" "$ROOT"

# load_docker_desktop <context>: pull the image onto the node via a throwaway pod
load_docker_desktop() {
  local ctx="${1:-docker-desktop}" pod="imgload-$$"
  trap 'kubectl --context "$ctx" -n default delete pod "$pod" --ignore-not-found --wait=false >/dev/null' RETURN
  kubectl --context "$ctx" -n default run "$pod" --image="$IMAGE" \
    --image-pull-policy=IfNotPresent --restart=Never --command -- true >/dev/null
  # The first pull can fail while the store catches up; the kubelet retries.
  if ! kubectl --context "$ctx" -n default wait pod "$pod" \
      --for=jsonpath='{.status.phase}'=Succeeded --timeout=120s >/dev/null; then
    echo "error: $IMAGE did not reach the node. Pod events:" >&2
    kubectl --context "$ctx" -n default get events --field-selector "involvedObject.name=$pod" >&2
    return 1
  fi
  echo "Loaded $IMAGE onto $ctx"
}

if [ "$TARGET" != "docker-desktop" ]; then
  mkdir -p "$ROOT/images"
  docker save -o "$TAR" "$IMAGE"
  echo "Saved $IMAGE to $TAR"
fi

case "$TARGET" in
  docker-desktop) load_docker_desktop "$CLUSTER" ;;
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
