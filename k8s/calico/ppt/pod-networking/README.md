# Calico Pod Networking HTML presentation

Open `index.html` in a modern Chromium, Edge, Firefox, or Safari browser. The deck is fully local and does not load runtime assets from the network.

## Presentation controls

- `Right Arrow`, `Page Down`, or `Space`: next slide
- `Left Arrow` or `Page Up`: previous slide
- `Home` / `End`: first / last slide
- `N`: speaker notes
- `O`: slide overview
- `F`: fullscreen
- Swipe horizontally on touch screens

The replay buttons restart packet and CNI lifecycle animations. On the cross-node slide, use the segmented control to compare the actual same-underlay-subnet path with the VXLAN path used across underlay subnets.

The speaker notes panel can be closed with its top-right close button, the `N` key, `Escape`, or by clicking outside the panel. The presentation controls remain available while notes are open.

## Source alignment

The lab configuration follows:

- Kubernetes Networking Labs Lesson 02: `https://k8snetworking.com/lessons/02-pod-network`
- Repository folder: `containerlab/02-pod-network`
- Kind node image: `kindest/node:v1.28.0`
- Calico: `v3.30.0`
- Pod CIDR: `192.168.0.0/16`
- Service CIDR: `10.96.0.0/16`
- IPAM block size: `/26`
- Encapsulation: `VXLANCrossSubnet`

Cross-node examples are explicitly marked as Lesson 03 extensions. Example IP addresses and interface names must be replaced with values from the live lab.

## Printing

Browser print mode lays out one 1600 x 900 slide per page. Interactive controls and speaker notes are hidden in print output.
