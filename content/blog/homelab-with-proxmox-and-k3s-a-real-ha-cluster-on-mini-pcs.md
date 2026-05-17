---
title: Homelab with Proxmox and k3s - A Real HA Cluster on Mini PCs
date_created: 2026-05-17T21:00:00Z
date_modified: 2026-05-17T21:57:00Z
description: How I built a real high-availability Kubernetes cluster using Proxmox, k3s, MetalLB, cert-manager, Prometheus, Grafana and a home dashboard on three mini PCs to self-host my own services and take back control of my data
---

## Introduction

Cloud services are convenient, but they come with a cost — both financial and in terms of privacy. Over time, I found myself paying for Bitwarden, Google Photos, and various other SaaS tools while also handing over my personal data to third parties. I decided it was time to take back control.

The result is a three-node homelab cluster running Proxmox and k3s, capable of real high availability (HA), hosting everything from password management to photo backups — all on hardware sitting on my desk.

In this post I'll walk through the hardware, the architecture decisions, and the key components that make it all work.

## Hardware

The cluster is made up of three mini PCs, each running Proxmox as the hypervisor:

| Node | Machine | CPU | RAM | Storage | Role |
|------|---------|-----|-----|---------|------|
| cp | Lenovo ThinkCentre M70q Tiny | Intel Core i7-12700T | 32 GB | 1 TB NVMe | Control Plane |
| wk1 | Dell OptiPlex 7020 Micro | Intel Core i5-12500T | 16 GB | 256 GB NVMe | Worker |
| wk2 | Dell OptiPlex 7020 Micro | Intel Core i5-12500T | 16 GB | 256 GB NVMe | Worker |

The Lenovo M70q is the beefiest node and acts as the k3s control plane, while the two Dell OptiPlex machines handle the workloads. All three are compact, power-efficient, and surprisingly capable for the price.

## Network Architecture

One of the most important decisions in a homelab HA setup is the network layout. I separated traffic into two dedicated networks:

- **Management network (1 Gbps)**: Used for Proxmox management, SSH, and general cluster communication.
- **Corosync/cluster sync network (2.5 Gbps)**: Dedicated to Proxmox cluster heartbeat and live migration traffic. Using a faster, isolated link here prevents cluster split-brain scenarios caused by network congestion on the management interface.

This separation is critical for a real HA setup. If Corosync traffic shares the same interface as general traffic, a busy network can cause false node fencing events.

## Why Proxmox?

I chose Proxmox VE as the hypervisor for a few reasons:

- **Free and open source**: No licensing costs, unlike VMware ESXi.
- **Built-in clustering**: Proxmox Cluster File System (pmxcfs) and Corosync give you HA out of the box.
- **KVM + LXC**: You can run both full VMs and lightweight containers.
- **Web UI**: The management interface is excellent for a homelab.

Each mini PC runs Proxmox, and the three nodes form a Proxmox cluster. This means VMs can be live-migrated between nodes and, in case of a node failure, they can be automatically restarted on a healthy node.

## k3s on Top of Proxmox

Rather than running k3s directly on bare metal, I run it inside Proxmox VMs. This gives me:

- **Snapshot and backup**: I can snapshot the entire VM state before upgrades.
- **Resource isolation**: Each k3s node is a VM with defined CPU and memory limits.
- **Flexibility**: I can easily resize or recreate a node without touching the physical machine.

The k3s cluster follows the standard single control plane + two worker nodes topology:

```
┌─────────────────────────────────────────────┐
│              Proxmox Cluster                │
│                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │  M70q    │  │ OPX 7020 │  │ OPX 7020 │  │
│  │          │  │          │  │          │  │
│  │  k3s-cp  │  │  k3s-wk1 │  │  k3s-wk2 │  │
│  └──────────┘  └──────────┘  └──────────┘  │
└─────────────────────────────────────────────┘
```

### Installing k3s

The control plane node is installed with the embedded etcd datastore for HA readiness:

```bash
curl -sfL https://get.k3s.io | sh -s - server \
  --cluster-init \
  --disable traefik \
  --disable servicelb
```

I disable the built-in Traefik and ServiceLB because I use MetalLB and a custom ingress controller instead.

Worker nodes join using the cluster token:

```bash
curl -sfL https://get.k3s.io | K3S_URL=https://<cp-ip>:6443 \
  K3S_TOKEN=<node-token> sh -
```

## Exposing Services with MetalLB

Since this is a bare-metal cluster (no cloud load balancer), I use [MetalLB](https://metallb.universe.tf/) in Layer 2 mode to assign real IP addresses to `LoadBalancer` services.

```yaml
apiVersion: metallb.io/v1beta1
kind: IPAddressPool
metadata:
  name: homelab-pool
  namespace: metallb-system
spec:
  addresses:
    - 192.168.1.200-192.168.1.220
---
apiVersion: metallb.io/v1beta1
kind: L2Advertisement
metadata:
  name: homelab-l2
  namespace: metallb-system
spec:
  ipAddressPools:
    - homelab-pool
```

Any service of type `LoadBalancer` now gets an IP from the `192.168.1.200–220` range, making it reachable from anywhere on my local network.

## TLS with cert-manager and a Local CA

For internal services I don't want to expose to the internet, I use [cert-manager](https://cert-manager.io/) with a self-signed local Certificate Authority. This gives every service a valid TLS certificate without relying on Let's Encrypt or exposing ports 80/443 to the outside world.

### Setting Up the Local CA

First, generate the CA key and certificate:

```bash
openssl genrsa -out ca.key 4096
openssl req -new -x509 -days 3650 -key ca.key \
  -out ca.crt \
  -subj "/CN=Homelab CA/O=Homelab"
```

Store it as a Kubernetes secret:

```bash
kubectl create secret tls homelab-ca \
  --cert=ca.crt \
  --key=ca.key \
  -n cert-manager
```

Create a `ClusterIssuer` that uses this CA:

```yaml
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: homelab-ca-issuer
spec:
  ca:
    secretName: homelab-ca
```

Now any `Certificate` or `Ingress` resource can request a TLS certificate signed by your local CA:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: bitwarden
  annotations:
    cert-manager.io/cluster-issuer: homelab-ca-issuer
spec:
  tls:
    - hosts:
        - bitwarden.homelab.local
      secretName: bitwarden-tls
  rules:
    - host: bitwarden.homelab.local
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: bitwarden
                port:
                  number: 80
```

The only thing left is to import `ca.crt` into your browser or OS trust store on each device you use. Once done, all your homelab services show a green padlock.

## Storage: NFS + Local Path

For storage I use a combination of two approaches:

- **local-path**: The default k3s storage class. Fast, simple, uses the node's local NVMe. Good for stateless workloads or anything that doesn't need to survive node failures.
- **NFS**: A shared NFS export from the M70q (which has the 1 TB NVMe) mounted on all nodes. Used for workloads that need persistent, shared storage — like Nextcloud or Immich.

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: nextcloud-data
spec:
  storageClassName: nfs-client
  accessModes:
    - ReadWriteMany
  resources:
    requests:
      storage: 200Gi
```

`ReadWriteMany` is key here — it allows the volume to be mounted by multiple pods simultaneously, which is needed for Nextcloud's data directory.

## What I Self-Host

The whole point of this setup is to replace paid cloud services with self-hosted alternatives. Here's what's running on the cluster:

| Service | Replaces | Notes |
|---------|----------|-------|
| [Vaultwarden](https://github.com/dani-garcia/vaultwarden) | Bitwarden Premium | Lightweight Bitwarden-compatible server |
| [AdGuard Home](https://adguard.com/en/adguard-home/overview.html) | Pi-hole / DNS-based ad blocking | Network-wide ad and tracker blocking |
| [Tailscale](https://tailscale.com/) | VPN | Secure remote access to the cluster from anywhere |
| [Immich](https://immich.app/) | Google Photos | Self-hosted photo and video backup with ML features |
| [Nextcloud](https://nextcloud.com/) | Google Drive / Dropbox | File sync, calendar, contacts |
| Strava activity sync | Strava API | Powers the sports stats on this website |

Running these on my own hardware means my passwords, photos, and files never leave my home network. The only external dependency is Tailscale for remote access, which only acts as a relay — the data itself stays local.

## Lessons Learned

### Corosync needs a dedicated link

Early on I had Corosync running over the same 1 Gbps interface as everything else. During heavy NFS transfers, the cluster would occasionally report nodes as unreachable and trigger unnecessary fencing. Moving Corosync to the dedicated 2.5 Gbps link solved this completely.

### local-path is not HA

If a pod using `local-path` storage is scheduled on a node that goes down, it won't come back up on another node — the data is tied to that specific node's disk. For anything important, use NFS or consider Longhorn for a proper distributed storage layer.

### Resource requests matter

Without proper CPU and memory requests on pods, the scheduler can overcommit nodes and cause OOM kills. Setting realistic requests and limits on every workload keeps the cluster stable.

### Snapshots before upgrades

One of the biggest advantages of running k3s inside Proxmox VMs is the ability to snapshot before any major change. Before upgrading k3s or a critical application, I take a VM snapshot. If something breaks, rollback takes about 30 seconds.

## Observability: Grafana + Prometheus

With multiple services running across three nodes, knowing what's happening inside the cluster is essential. I use the [kube-prometheus-stack](https://github.com/prometheus-community/helm-charts/tree/main/charts/kube-prometheus-stack) Helm chart, which bundles Prometheus, Alertmanager, and Grafana in one shot.

```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update
helm install kube-prometheus-stack prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --create-namespace
```

Grafana comes pre-loaded with dashboards for node CPU/memory, pod resource usage, and Kubernetes cluster health. I expose it via an Ingress with a cert-manager TLS certificate, just like every other service on the cluster.

Prometheus scrapes metrics from:

- **Node Exporter** — CPU, RAM, disk, and network stats for each physical node
- **kube-state-metrics** — Kubernetes object state (deployments, pods, PVCs)
- **Application exporters** — services like AdGuard Home expose their own `/metrics` endpoint

Having this in place means I can spot a node running hot, a pod stuck in `CrashLoopBackOff`, or a disk filling up before it becomes a problem.

## Dashboard: A Single Pane of Glass

For a quick overview of everything running on the cluster, I use [Homarr](https://homarr.dev/) as a home dashboard. It shows all my self-hosted apps as tiles with live status indicators, so I can see at a glance whether Vaultwarden, Nextcloud, or AdGuard Home is up.

Alternatively, tools like [Homepage](https://gethomepage.dev/) or [Heimdall](https://heimdall.site/) work equally well — the choice is mostly aesthetic. I went with Homarr because it integrates directly with Docker and Kubernetes service discovery.

The dashboard is deployed as a standard Kubernetes `Deployment` and exposed via MetalLB + Ingress, same as everything else:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: homarr
  namespace: default
spec:
  replicas: 1
  selector:
    matchLabels:
      app: homarr
  template:
    metadata:
      labels:
        app: homarr
    spec:
      containers:
        - name: homarr
          image: ghcr.io/ajnart/homarr:latest
          ports:
            - containerPort: 7575
```

Opening the dashboard URL gives me a single page with links to every service, their status, and quick-access widgets for things like AdGuard stats or Proxmox node health.

## What's Next

The cluster is stable and serving all my needs, but there are a few things I want to improve:

- **Longhorn**: Replace NFS with a proper distributed block storage solution for better resilience.
- **Flux or ArgoCD**: Move to GitOps for managing all cluster manifests.
- **Second control plane node**: Add a second k3s server node for true control plane HA.

## Conclusion

Building a homelab HA cluster with Proxmox and k3s has been one of the most rewarding infrastructure projects I've worked on. The combination of Proxmox's VM management, k3s's lightweight Kubernetes, MetalLB for load balancing, and cert-manager for TLS creates a surprisingly production-like environment at home.

More importantly, I've taken back control of my data. My passwords, photos, files, and DNS queries no longer pass through third-party servers. The hardware cost was a one-time investment, and the running costs are just electricity — far cheaper than the subscriptions I was paying before.

If you're thinking about building your own homelab, I'd encourage you to start small. Even a single mini PC running Proxmox and k3s is enough to self-host most services. You can always add nodes later.

## Resources

- [Proxmox VE Documentation](https://pve.proxmox.com/pve-docs/)
- [k3s Documentation](https://docs.k3s.io/)
- [MetalLB Documentation](https://metallb.universe.tf/)
- [cert-manager Documentation](https://cert-manager.io/docs/)
- [kube-prometheus-stack](https://github.com/prometheus-community/helm-charts/tree/main/charts/kube-prometheus-stack)
- [Homarr Dashboard](https://homarr.dev/)
- [Vaultwarden](https://github.com/dani-garcia/vaultwarden)
- [Immich](https://immich.app/)

Happy homelabbing! 🏠☸️
