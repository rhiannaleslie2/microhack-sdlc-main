targetScope = 'resourceGroup'

@description('Azure region for all resources. Defaults to the resource group location.')
param location string = resourceGroup().location

@description('Short lowercase prefix used to derive resource names.')
@minLength(2)
@maxLength(10)
param namePrefix string = 'octocat'

@description('Environment name used to derive resource names.')
@minLength(2)
@maxLength(6)
param environmentName string = 'dev'

@description('API image reference in the bootstrapped ACR.')
param apiImage string

@description('Frontend image reference in the bootstrapped ACR.')
param frontendImage string

@description('Maximum frontend replicas. The SQLite API is intentionally fixed at one replica.')
@minValue(1)
@maxValue(10)
param maxFrontendReplicas int = 3

var baseName = '${namePrefix}-${environmentName}'
var uniqueSuffix = take(uniqueString(resourceGroup().id), 6)
var registryName = toLower(replace('${namePrefix}${environmentName}${uniqueSuffix}acr', '-', ''))
var storageAccountName = toLower(replace('${namePrefix}${environmentName}${uniqueSuffix}st', '-', ''))
var logAnalyticsName = '${baseName}-logs'
var environmentResourceName = '${baseName}-env'
var apiAppName = '${baseName}-api'
var frontendAppName = '${baseName}-frontend'
var pullIdentityName = '${baseName}-pull'
var databaseStorageName = 'database'
var databaseShareName = 'octocat-data'

var commonTags = {
  project: 'octocat-supply'
  challenge: 'challenge-05-azure-deploy'
  managedBy: 'bicep'
  environment: environmentName
}

resource registry 'Microsoft.ContainerRegistry/registries@2023-11-01-preview' existing = {
  name: registryName
}

resource pullIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' existing = {
  name: pullIdentityName
}

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageAccountName
  location: location
  tags: commonTags
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    accessTier: 'Hot'
    allowBlobPublicAccess: false
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
  }
}

resource fileService 'Microsoft.Storage/storageAccounts/fileServices@2023-01-01' existing = {
  parent: storageAccount
  name: 'default'
}

resource databaseShare 'Microsoft.Storage/storageAccounts/fileServices/shares@2023-01-01' = {
  parent: fileService
  name: databaseShareName
  properties: {
    shareQuota: 5
  }
}

module logAnalytics 'modules/loganalytics.bicep' = {
  name: 'loganalytics'
  params: {
    location: location
    workspaceName: logAnalyticsName
    retentionInDays: 30
    tags: commonTags
  }
}

module environment 'modules/containerapp-env.bicep' = {
  name: 'containerapp-env'
  params: {
    location: location
    environmentName: environmentResourceName
    logAnalyticsWorkspaceId: logAnalytics.outputs.workspaceId
    tags: commonTags
  }
}

resource appEnvironment 'Microsoft.App/managedEnvironments@2024-03-01' existing = {
  name: environmentResourceName
}

resource environmentStorage 'Microsoft.App/managedEnvironments/storages@2024-03-01' = {
  parent: appEnvironment
  name: databaseStorageName
  properties: {
    azureFile: {
      accountName: storageAccount.name
      accountKey: storageAccount.listKeys().keys[0].value
      shareName: databaseShare.name
      accessMode: 'ReadWrite'
    }
  }
  dependsOn: [
    environment
  ]
}

module apiApp 'modules/containerapp.bicep' = {
  name: 'api-app'
  params: {
    location: location
    appName: apiAppName
    environmentId: environment.outputs.environmentId
    image: apiImage
    targetPort: 3000
    externalIngress: false
    registryLoginServer: registry.properties.loginServer
    userAssignedIdentityId: pullIdentity.id
    minReplicas: 1
    maxReplicas: 1
    tags: commonTags
    env: [
      {
        name: 'DB_FILE'
        value: '/app/data/app.db'
      }
    ]
    volumes: [
      {
        name: 'sqlite-data'
        storageType: 'AzureFile'
        storageName: databaseStorageName
      }
    ]
    volumeMounts: [
      {
        volumeName: 'sqlite-data'
        mountPath: '/app/data'
      }
    ]
    probes: [
      {
        type: 'Readiness'
        httpGet: {
          path: '/'
          port: 3000
          scheme: 'HTTP'
        }
        initialDelaySeconds: 10
        periodSeconds: 10
        timeoutSeconds: 5
        failureThreshold: 3
      }
      {
        type: 'Liveness'
        httpGet: {
          path: '/'
          port: 3000
          scheme: 'HTTP'
        }
        initialDelaySeconds: 15
        periodSeconds: 30
        timeoutSeconds: 5
        failureThreshold: 3
      }
    ]
  }
  dependsOn: [
    environmentStorage
  ]
}

module frontendApp 'modules/containerapp.bicep' = {
  name: 'frontend-app'
  params: {
    location: location
    appName: frontendAppName
    environmentId: environment.outputs.environmentId
    image: frontendImage
    targetPort: 80
    externalIngress: true
    registryLoginServer: registry.properties.loginServer
    userAssignedIdentityId: pullIdentity.id
    minReplicas: 1
    maxReplicas: maxFrontendReplicas
    tags: commonTags
    env: [
      {
        name: 'API_HOST'
        value: apiApp.outputs.fqdn
      }
      {
        name: 'API_PORT'
        value: '443'
      }
    ]
    probes: [
      {
        type: 'Readiness'
        httpGet: {
          path: '/'
          port: 80
          scheme: 'HTTP'
        }
        initialDelaySeconds: 5
        periodSeconds: 10
        timeoutSeconds: 5
        failureThreshold: 3
      }
      {
        type: 'Liveness'
        httpGet: {
          path: '/'
          port: 80
          scheme: 'HTTP'
        }
        initialDelaySeconds: 10
        periodSeconds: 30
        timeoutSeconds: 5
        failureThreshold: 3
      }
    ]
  }
}

@description('ACR login server used by both container apps.')
output acrLoginServer string = registry.properties.loginServer

@description('Public URL of the frontend.')
output frontendUrl string = 'https://${frontendApp.outputs.fqdn}'

@description('Name of the internal API container app.')
output apiAppName string = apiAppName

@description('Name of the storage account holding the SQLite file share.')
output storageAccountName string = storageAccount.name
