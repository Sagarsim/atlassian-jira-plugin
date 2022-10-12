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
    // console.log("finalAssetTypes ==>", finalAssetTypes);
    // const reqConfig = getAtlasRequestConfig("GET", config.atlasEmail, config.atlasToken);
    // const icons = await api.fetch(`https://api.atlassian.com/jsm/insight/workspace/${config.workspaceId}/v1/icon/global`,
    //     reqConfig
    // );
    // const iconJson = await icons.json();
    // console.log("icons ==>", iconJson);
    const createSchemaArr = finalAssetTypes.map(tp => {
      const reqConfig = getAtlasRequestConfig("POST", config.atlasEmail, config.atlasToken);
      reqConfig.body = JSON.stringify({
        "inherited": false,
        "abstractObjectType": false,
        "objectSchemaId": "3",
        "iconId": "87",
        "name": tp
      })
      return api.fetch(`https://api.atlassian.com/jsm/insight/workspace/${config.workspaceId}/v1/objecttype/create`,
        reqConfig
      );
    })
    const createSchemaResponse = await Promise.all(createSchemaArr);
    console.log("createSchemaReponse ==>", createSchemaResponse);
  } catch(err){
    console.log("err ==>", err);
  }
}

resolver.define("create-object-type-listener", async ({ payload, context }) => {
	// process the event
});

export const handler = resolver.getDefinitions();