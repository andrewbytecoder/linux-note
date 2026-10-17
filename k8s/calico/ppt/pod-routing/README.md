# Calico Pod Routing HTML presentation

Open `index.html` in a modern Chromium, Edge, Firefox, or Safari browser. All runtime assets are local.

## Controls

- `Right Arrow`, `Page Down`, or `Space`: next slide
- `Left Arrow` or `Page Up`: previous slide
- `Home` / `End`: first / last slide
- `N`: speaker notes
- `O`: slide overview
- `F`: fullscreen
- Swipe horizontally on a touch screen

The notes panel closes with its top-right close button, `N`, `Escape`, or a click outside the panel. Replay buttons restart the Node, same-node, cross-node, TTL, and capture animations. The encapsulation slide switches between the Lesson 03 direct-routing path and the VXLAN path used when node IPs cross underlay subnets.

## Lab alignment

- Course: `https://k8snetworking.com/lessons/03-pod-routing`
- Repository folder: `containerlab/03-pod-routing`
- Kind image: `kindest/node:v1.28.0`
- Calico: `v3.30.0`
- Pod CIDR: `192.168.0.0/16`
- Service CIDR: `10.96.0.0/16`
- IPAM block size: `/26`
- Encapsulation: `VXLANCrossSubnet`

Pod names, IP addresses, interface names, and timing output in the deck come from course examples. Replace them with values from the live lab before presenting commands.

## Course repository notes

- The actual repository directory includes the `03-` prefix even though one page command omits it.
- The final `deploy.sh` status command selects `app=multitool`, while the DaemonSets use `app=multitool-1` and `app=multitool-2`. Use `kubectl get pods -o wide` for verification.

## Printing

Browser print mode lays out one 1600 x 900 slide per page and hides interactive controls.
