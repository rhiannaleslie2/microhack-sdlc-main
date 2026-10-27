# Azure deployment

This deployment uses Bicep and Azure Container Apps for the current Python API
and React frontend. The Bicep templates are split into a one-time bootstrap and
an application deployment so that images exist in ACR before Container Apps
attempt to pull them.

## Architecture

```text
Browser
  │ HTTPS
  ▼
Public frontend Container App (nginx)
  │ /api proxy over the Container Apps environment
  ▼
Internal Python API Container App
  │
  ├── Azure Files share mounted at /app/data (SQLite demo persistence)
  └── Log Analytics
```

- **Azure Container Registry (Basic)** stores SHA-tagged API and frontend
  images. Admin credentials are disabled.
- **User-assigned managed identity** gives Container Apps `AcrPull`; no registry
  password is stored in the apps.
- **Container Apps Consumption environment** hosts the frontend and API.
  Frontend ingress is public; API ingress is internal.
- **Storage account and Azure Files share** persist the SQLite file across
  container revisions. The API is intentionally fixed at one replica.
- **Log Analytics** receives Container Apps logs with 30-day retention.

### SQLite limitation

Azure Files-mounted SQLite is a constrained demo/hackathon choice, not a
production database. SQLite WAL and network file-share locking are not a sound
foundation for concurrent or highly available workloads. Keep the API at one
replica. Before production, migrate the API persistence layer and migrations to
a managed database such as Azure Database for PostgreSQL Flexible Server; the
current API uses SQLite-specific SQL and cannot use PostgreSQL by only changing
an environment variable.

## One-time Azure and GitHub setup

Install the Azure CLI with Bicep support, Docker, and authenticate with an Azure
identity that can create a resource group, managed identity, and role
assignments. Choose a globally unique resource group name and an Azure region
that supports Container Apps.

```bash
az group create --name <resource-group> --location <region>

az deployment group create \
  --resource-group <resource-group> \
  --name bootstrap-acr \
  --template-file infra/bootstrap.bicep \
  --parameters namePrefix=octocat environmentName=dev
```

The bootstrap creates ACR and the image-pull identity, and grants that identity
`AcrPull`. Record the registry name:

```bash
az deployment group show \
  --resource-group <resource-group> \
  --name bootstrap-acr \
  --query properties.outputs.registryName.value \
  --output tsv
```

Configure a GitHub federated credential for the repository and the branch from
which you will run the workflow. Give its service principal:

- `Contributor` on the deployment resource group.
- `AcrPush` on the bootstrapped registry.

The deployment workflow does not create role assignments. This keeps its
permissions separate from the one-time bootstrap administrator. In GitHub
Actions, configure these **secrets**:

- `AZURE_CLIENT_ID`
- `AZURE_TENANT_ID`
- `AZURE_SUBSCRIPTION_ID`

Configure these **repository or environment variables**:

- `AZURE_RESOURCE_GROUP`
- `AZURE_LOCATION`

The workflow is manual (`workflow_dispatch`) and uses OIDC; it does not need a
client secret. Run **Deploy OctoCAT to Azure** from the Actions tab. It builds
the Python API using `src/api-py/Dockerfile`, builds the frontend, pushes both
images using the commit SHA as the tag, and deploys `infra/main.bicep`.

## Manual image build and app deployment

After the one-time bootstrap, a local deployment can build and push the images
then deploy the apps:

```bash
ACR_NAME="$(az deployment group show \
  --resource-group <resource-group> \
  --name bootstrap-acr \
  --query properties.outputs.registryName.value \
  --output tsv)"
ACR_LOGIN_SERVER="$(az acr show --name "$ACR_NAME" --query loginServer --output tsv)"
IMAGE_TAG="$(git rev-parse --short HEAD)"

az acr login --name "$ACR_NAME"
docker build -f src/api-py/Dockerfile -t "$ACR_LOGIN_SERVER/api:$IMAGE_TAG" src
docker build -f src/frontend/Dockerfile -t "$ACR_LOGIN_SERVER/frontend:$IMAGE_TAG" src/frontend
docker push "$ACR_LOGIN_SERVER/api:$IMAGE_TAG"
docker push "$ACR_LOGIN_SERVER/frontend:$IMAGE_TAG"

az deployment group create \
  --resource-group <resource-group> \
  --name octocat-app \
  --template-file infra/main.bicep \
  --parameters infra/main.parameters.json \
  --parameters \
      apiImage="$ACR_LOGIN_SERVER/api:$IMAGE_TAG" \
      frontendImage="$ACR_LOGIN_SERVER/frontend:$IMAGE_TAG"
```

Read the public frontend URL from the deployment:

```bash
az deployment group show \
  --resource-group <resource-group> \
  --name octocat-app \
  --query properties.outputs.frontendUrl.value \
  --output tsv
```

The API image includes the shared SQL migrations and seed files. On startup,
the API initializes the mounted database and applies migrations before serving
requests.

## Bicep files

| File | Purpose |
| --- | --- |
| `bootstrap.bicep` | One-time ACR, image-pull identity, and `AcrPull` assignment. |
| `main.bicep` | Storage, Log Analytics, Container Apps environment, API, and frontend. |
| `modules/registry.bicep` | ACR definition with admin access disabled. |
| `modules/loganalytics.bicep` | Log Analytics workspace with configured retention. |
| `modules/containerapp-env.bicep` | Shared Container Apps environment. |
| `modules/containerapp.bicep` | Reusable Container App definition with managed-identity image pulls, probes, and volume support. |
