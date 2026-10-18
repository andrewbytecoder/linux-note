# Calico Multiple IPPools HTML presentation

Open `index.html` directly in a modern browser. All presentation images are stored locally.

## Controls

- `Right Arrow`, `Page Down`, or `Space`: next slide
- `Left Arrow` or `Page Up`: previous slide
- `Home` / `End`: first / last slide
- `N`: speaker notes
- `O`: slide overview
- `F`: fullscreen

The notes panel closes with its close button, `N`, `Escape`, or by clicking outside. Replay buttons restart pool selection, DaemonSet rollout, IPAM allocation, block affinity, and cross-pool traffic animations.

## Lab alignment

- Course: `https://k8snetworking.com/lessons/09-multi-ippool`
- Repository folder: `containerlab/09-multi-ippool`
- Kind cluster: `k01`, three nodes
- Calico: `3.30.0`
- Kubernetes Pod CIDR: `192.168.0.0/16`
- Default pool: `192.168.0.0/17`, `nodeSelector: all()`
- Secondary pool: `192.168.128.0/17`, `nodeSelector: "!all()"`
- Workload block size: `/26`
- Pool annotation: `cni.projectcalico.org/ipv4pools`

Pod names, IP addresses, block affinities, timestamps, and container management addresses in the deck are course examples. Read current values from the live lab before running filtered commands.

## Technical notes reflected in the deck

- The pool annotation is a JSON array encoded inside a YAML string.
- Pod annotations take precedence over namespace annotations; namespace annotations take precedence over automatic pool selection.
- The annotation must exist when the pod is created. Existing pods need recreation to receive an address from another pool.
- `nodeSelector: "!all()"` removes a pool from automatic node selection, while an explicit workload annotation can request it.
- Multiple IP pools segment address allocation. They do not create a security boundary without NetworkPolicy.
- The inherited `loadbalancer-ip-pool` has `allowedUses: [LoadBalancer]` and is not a workload pool.

## Printing

Browser print mode lays out one 1600 x 900 slide per page and hides interactive controls.
