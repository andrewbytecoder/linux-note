# Kubernetes Services ClusterIP HTML presentation

Open `index.html` directly in a modern browser. The presentation is fully local.

## Controls

- `Right Arrow`, `Page Down`, or `Space`: next slide
- `Left Arrow` or `Page Up`: previous slide
- `Home` / `End`: first / last slide
- `N`: speaker notes
- `O`: slide overview
- `F`: fullscreen

The notes panel closes with its top-right close button, `N`, `Escape`, or by clicking outside the panel. Replay buttons restart the control-plane, iptables-chain, local-backend, and remote-backend animations. The Endpoint selector switches the animated new connection between the two nginx Pods.

## Lab alignment

- Course: `https://k8snetworking.com/lessons/04-k8s-services`
- Repository folder: `containerlab/04-k8s-services`
- Kind image: `kindest/node:v1.28.0`
- Calico: `v3.30.0`
- Pod CIDR: `192.168.0.0/16`
- Service CIDR: `10.96.0.0/16`
- Example Service: `nginx-service`, `10.96.204.67:80`
- Example Endpoints: `192.168.156.5:80`, `192.168.202.196:80`

## Repository drift noted in the deck

The current repository's `04-k8s-services/tools` folder contains only `nginx-deployment.yaml`, while the lesson page assumes existing multitool DaemonSets. The deck includes a temporary `svc-client` Pod command for repository versions without multitool Pods.

Service VIPs, Pod IPs, Pod suffixes, and iptables chain hashes are dynamic. Read them from the live cluster before running commands.

## Printing

Browser print mode lays out one 1600 x 900 slide per page and hides interactive controls.
