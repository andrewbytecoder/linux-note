# Docker deployment

Build and start the presentation:

```bash
docker compose up -d --build
```

Open:

```text
http://localhost:8080/
```

From another computer on the same network, use the Docker host address:

```text
http://<docker-host-ip>:8080/
```

Make sure the host firewall allows the selected TCP port.

Use a different host port when `8080` is occupied:

```bash
PRESENTATION_PORT=8090 docker compose up -d --build
```

On PowerShell:

```powershell
$env:PRESENTATION_PORT = "8090"
docker compose up -d --build
```

Check status and logs:

```bash
docker compose ps
docker compose logs -f calico-bgp-presentation
```

Stop and remove the container:

```bash
docker compose down
```

Rebuild after updating the presentation files:

```bash
docker compose up -d --build --force-recreate
```

Build the image without starting Compose:

```bash
docker compose build
```

Export the image for offline sharing:

```bash
docker save -o calico-bgp-presentation.tar calico-bgp-presentation:local
```

Import and run it on another Docker host:

```bash
docker load -i calico-bgp-presentation.tar
docker run -d \
  --name calico-bgp-presentation \
  --restart unless-stopped \
  -p 8080:80 \
  calico-bgp-presentation:local
```

The image contains `index.html`, `styles.css`, `app.js`, and the `assets/` directory. It does not need the source workspace after the image has been built.
