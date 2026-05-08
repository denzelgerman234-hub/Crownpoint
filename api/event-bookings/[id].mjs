import handleTalentApiRequest from '../../server/talentCatalogApi.mjs'

export default async function handler(request, response) {
  return handleTalentApiRequest(request, response)
}
