# Kubernetes DNS HTML presentation

Open `index.html` directly in a modern browser. All presentation assets are local.

## Controls

- `Right Arrow`, `Page Down`, or `Space`: next slide
- `Left Arrow` or `Page Up`: previous slide
- `Home` / `End`: first / last slide
- `N`: speaker notes
- `O`: slide overview
- `F`: fullscreen

The notes panel closes with its close button, `N`, `Escape`, or by clicking outside. Replay buttons restart the end-to-end query, `ndots:5` expansion, and external-forwarding animations.

## Lab alignment

- Course: `https://k8snetworking.com/lessons/05-k8s-dns`
- Repository folder: `containerlab/05-k8s-dns`
- Kind image: `kindest/node:v1.28.0`
- Calico: `v3.30.0`
- Pod CIDR: `192.168.0.0/16`
- Service CIDR: `10.96.0.0/16`
- Cluster domain: `cluster.local`
- DNS Service: `kube-dns`, example ClusterIP `10.96.0.10`

Pod names, Pod IPs, Service IPs, resolver search suffixes, and upstream resolver values in the deck are course examples. Read them from the live lab before running commands.

## Course notes reflected in the deck

- `dig` does not apply the resolver search list unless `+search` is used.
- Short names resolve in the caller's namespace; cross-namespace access needs `service.namespace` or a full FQDN.
- CoreDNS `loadbalance` randomizes A, AAAA, and MX answer order. Upstream resolver selection belongs to the `forward` plugin.
- The current `deploy.sh` status selector uses `app=multitool`, while the manifests use `app=multitool-1`, `app=multitool-2`, and `app=multitool-3`. Verify with `kubectl get pods -A -o wide`.

## Printing

Browser print mode lays out one 1600 x 900 slide per page and hides interactive controls.
