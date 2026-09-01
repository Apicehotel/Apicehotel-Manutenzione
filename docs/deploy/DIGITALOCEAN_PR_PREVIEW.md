# DigitalOcean PR Preview

RandApp usa `digitalocean/app_action/deploy@v2` per creare preview isolate delle pull request.

La preview della PR clona la configurazione dell'app App Platform esistente `randapp` tramite `app_name: randapp`, evitando di richiedere un file `.do/app.yaml` nel repository.

La produzione resta separata e continua a usare il workflow manuale `digitalocean-deploy.yml` su `main`.
