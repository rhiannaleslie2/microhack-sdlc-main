targetScope = 'resourceGroup'

@description('Azure region for the bootstrap resources.')
param location string = resourceGroup().location

@description('Short lowercase prefix used to derive resource names.')
@minLength(2)
@maxLength(10)
param namePrefix string = 'octocat'

@description('Environment name used to derive resource names.')
@minLength(2)
@maxLength(6)
param environmentName string = 'dev'

var baseName = '${namePrefix}-${environmentName}'
var uniqueSuffix = take(uniqueString(resourceGroup().id), 6)
var registryName = toLower(replace('${namePrefix}${environmentName}${uniqueSuffix}acr', '-', ''))
var pullIdentityName = '${baseName}-pull'
var commonTags = {
  project: 'octocat-supply'
  challenge: 'challenge-05-azure-deploy'
  managedBy: 'bicep'
  environment: environmentName
}

module registry 'modules/registry.bicep' = {
  name: 'registry'
  params: {
    location: location
    registryName: registryName
    tags: commonTags
  }
}

resource pullIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: pullIdentityName
  location: location
  tags: commonTags
}

resource registryResource 'Microsoft.ContainerRegistry/registries@2023-11-01-preview' existing = {
  name: registryName
}

resource acrPullAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(registryResource.id, pullIdentity.id, 'AcrPull')
  scope: registryResource
  properties: {
    principalId: pullIdentity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d')
  }
  dependsOn: [
    registry
  ]
}

@description('Name of the Azure Container Registry.')
output registryName string = registry.outputs.registryName

@description('ACR login server.')
output registryLoginServer string = registry.outputs.loginServer

@description('Name of the user-assigned identity used by Container Apps to pull images.')
output pullIdentityName string = pullIdentity.name

@description('Principal ID of the Container Apps image-pull identity.')
output pullIdentityPrincipalId string = pullIdentity.properties.principalId

@description('Client ID of the Container Apps image-pull identity.')
output pullIdentityClientId string = pullIdentity.properties.clientId
