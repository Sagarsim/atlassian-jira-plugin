import api, { storage, webTrigger } from '@forge/api';
import { getAtlasRequestConfig, getLsRequestConfig } from './helper';
import { Queue } from '@forge/events';
import Resolver from "@forge/resolver";
const queue = new Queue({ key: 'create-object-type-queue' });
const resolver = new Resolver();

export const createObjectSchema = async () => {
  try {
    const config = await storage.getSecret("lsConfig");
    console.log("config ==>", config);
    let query = `{${config.selectedSites.map((st, i) => `site${i+1}: site(id: \"${st}\") {id assetTypes}`)}}`
    console.log("query ==>", query);
    const allAssetTypes = await api.fetch("https://api.lansweeper.com/api/v2/graphql", 
      getLsRequestConfig(config.lsToken, query)
    );
    const assetTypes = await allAssetTypes.json();
    console.log("assetTypes ==>", assetTypes);
    let finalAssetTypes = config.selectedSites.map((st, i) => {
      return assetTypes.data[`site${i+1}`].assetTypes;
    })
    finalAssetTypes = finalAssetTypes.flat();
    const createSchemaArr = finalAssetTypes.map(tp => {

    })
    const createSchemaResponse = await Promise.all(createSchemaArr);
    console.log("createSchemaReponse ==>", createSchemaResponse);
  } catch(err){
    console.log("err ==>", err);
  }
}

resolver.define("create-object-type-listener", async ({ payload, context }) => {
	// process the event
  const reqConfig = getAtlasRequestConfig("POST", payload.atlasEmail, payload.atlasToken);
      reqConfig.body = JSON.stringify({
        "inherited": false,
        "abstractObjectType": false,
        "objectSchemaId": "4",
        "iconId": "87",
        "name": tp
      })
      const createObjectResponse = await api.fetch(`https://api.atlassian.com/jsm/insight/workspace/${config.workspaceId}/v1/objecttype/create`,
        reqConfig
      );
});

export const handler = resolver.getDefinitions();