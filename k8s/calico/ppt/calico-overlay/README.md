# Calico Overlay Networks HTML presentation

Open `index.html` directly in a modern browser. All presentation images are stored locally.

## Controls

- `Right Arrow`, `Page Down`, or `Space`: next slide
- `Left Arrow` or `Page Up`: previous slide
- `Home` / `End`: first / last slide
- `N`: speaker notes
- `O`: slide overview
- `F`: fullscreen

The notes panel closes with its close button, `N`, `Escape`, or by clicking outside. Replay buttons restart the CrossSubnet decision, route comparison, same-subnet path, VXLAN path, and header animations.

## Lab alignment

- Course: `https://k8snetworking.com/lessons/06-calico-overlay`
- Repository folder: `containerlab/06-calico-overlay`
- Kind cluster: `k01`, four nodes
- Arista cEOS: `4.34.0F`
- Calico: `3.30.0`
- Pod CIDR: `192.168.0.0/16`
- IPAM block size: `/26`
- Node subnet A: `10.10.10.0/24`
- Node subnet B: `10.10.20.0/24`
- Encapsulation: `VXLANCrossSubnet`

Block affinities, VTEP addresses, MAC addresses, Docker management IPs, and route entries in the slides are examples from the course. Read the values from the live lab before running filtered commands.

## Technical notes reflected in the deck

- CrossSubnet decides encapsulation from node underlay subnets, not from the shared Pod IPPool.
- Same-subnet remote Pod blocks use direct routes through `eth1`; cross-subnet blocks use `vxlan.calico` and remote VTEPs.
- `disableBGPExport` prevents pool routes from being exported over BGP. It does not disable Felix VXLAN route programming.
- WireGuard provides encryption and is not simply another VXLAN/IP-in-IP encapsulation type.
- VXLAN uses UDP port 4789 and commonly reduces an IPv4 workload MTU from 1500 to 1450.

## Printing

Browser print mode lays out one 1600 x 900 slide per page and hides interactive controls.
