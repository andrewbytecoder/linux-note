# Calico Advertise IPPool Using BGP HTML presentation

Open `index.html` directly in a modern browser. All presentation images are stored locally.

## Controls

- `Right Arrow`, `Page Down`, or `Space`: next slide
- `Left Arrow` or `Page Up`: previous slide
- `Home` / `End`: first / last slide
- `N`: speaker notes
- `O`: slide overview
- `F`: fullscreen

The notes panel closes with its close button, `N`, `Escape`, or by clicking outside. Replay buttons restart route advertisement, route reflection, ToR collection, and native ping animations.

## Lab alignment

- Course: `https://k8snetworking.com/lessons/10-calico-bgp-ippool`
- Repository folder: `containerlab/10-calico-bgp-ippool`
- Four-node Kind cluster across VLAN 10 and VLAN 20
- Calico and cEOS iBGP AS: `65010`
- Workload IPPool: `192.168.0.0/17`
- Workload block size: `/26`
- Encapsulation: `None`
- NAT outgoing: `Disabled`
- BGP export: enabled through `disableBGPExport: false`
- ToR: cEOS route reflector using `next-hop-self`

Pod names, IP addresses, IPAM blocks, BGP counters, timestamps, and management addresses in the slides are course examples. Read current values from the live lab before running filtered commands.

## Technical notes reflected in the deck

- BGP route distribution and IPAM allocation are separate stages.
- `prefixAdvertisements` configures per-prefix advertisement properties such as BGP communities; the concrete forwarding evidence is the per-node `/26` routes in the ToR and node FIBs.
- `encapsulation: None`, `natOutgoing: Disabled`, and `disableBGPExport: false` control different data-plane and control-plane behaviors.
- `next-hop-self` makes reflected routes point to the ToR SVI reachable from each client VLAN.
- External reachability beyond the ToR still requires upstream route propagation and a complete return path.
- CalicoNodeStatus is intended for diagnostic visibility and should be removed after temporary use.

## Printing

Browser print mode lays out one 1600 x 900 slide per page and hides interactive controls.
