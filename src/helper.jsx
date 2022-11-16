import api, {route, storage} from '@forge/api';
import { lsObjectSchemaDetails } from './constants';
const atlasRequestConfig = (method, username, password) => {
  return {
    method,
    headers: {
      'Authorization': 'Basic ' + Buffer.from(username + ":" + password).toString('base64'),
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }
  }
}

const lsRequestConfig = (token, query) => {
  return {
      method: "POST",
      headers: {
          "Content-Type": "application/json",
          "Authorization": `Token ${token}`
      },
      body: JSON.stringify({query})
  }
}

export const getAllAssetTypes = async (config) => {
    const query = `{${config.selectedSites.map((st, i) => `site${i+1}: site(id: \"${st.id}\") {id assetTypes}`)}}`
    const allAssetTypes = await api.fetch("https://api.lansweeper.com/api/v2/graphql", 
      getLsRequestConfig(config.lsToken, query)
    );
    const assetTypes = await allAssetTypes.json();
    // console.log("assetTypes ==>", assetTypes);
    let finalAssetTypes = config.selectedSites.map((st, i) => {
      return assetTypes.data[`site${i+1}`].assetTypes;
    })
    finalAssetTypes = finalAssetTypes.flat();
    console.log("asset types ==>", finalAssetTypes.length);
    const filteredAssetTypes = finalAssetTypes.filter((item, index) => finalAssetTypes.indexOf(item) === index)
    return filteredAssetTypes;
}

export const getSites = async (token) => {
    const allSites = await api.fetch("https://api.lansweeper.com/api/v2/graphql", 
      lsRequestConfig(token, "{ authorizedSites { sites { id name } } }")
    );
    const sitesJson = await allSites.json();
    return sitesJson.data.authorizedSites.sites ? sitesJson.data.authorizedSites.sites : []
}

export const validateAtlasToken = async (username, password) => {
    const res = await api.asUser().requestJira(route`/rest/servicedeskapi/insight/workspace`);
    const workspaceData = await res.json();
    const workspaceId = workspaceData.values[0].workspaceId;
    const reqConfig = atlasRequestConfig("GET", username, password);
    const configStatus = await api.fetch(`https://api.atlassian.com/jsm/insight/workspace/${workspaceId}/v1/config/statustype`,
      reqConfig
    );
    return configStatus.status === 200 ? workspaceId : ""
}

export const getObjectSchemaId = async (config) => {
    let objectSchemaId = 0;
    const schemaListReqConfig = getAtlasRequestConfig("GET", config.atlasEmail, config.atlasToken);
    const schemaList = await api.fetch(`https://api.atlassian.com/jsm/assets/workspace/${config.workspaceId}/v1/objectschema/list`,
      schemaListReqConfig
    )
    const schemaListJson = await schemaList.json();
    const schema = schemaListJson.values.find(val => val.name === lsObjectSchemaDetails.name && val.objectSchemaKey === lsObjectSchemaDetails.objectSchemaKey);
    if(schema){
      objectSchemaId = schema.id;
    } else {
      const createSchemaReqConfig = getAtlasRequestConfig("POST", config.atlasEmail, config.atlasToken);
      createSchemaReqConfig.body = JSON.stringify(lsObjectSchemaDetails);
      const createdSchema = await api.fetch(`https://api.atlassian.com/jsm/assets/workspace/${config.workspaceId}/v1/objectschema/create`,
        createSchemaReqConfig
      )
      const createdSchemaJson = await createdSchema.json();
      objectSchemaId = createdSchemaJson.id;
    }
    return objectSchemaId;
}

export const validateObjectSchema = async (config, totalAssetTypes, createdObjectSchemaId) => {
    let total = 0;
    let objectSchemaId = 0;
    if(totalAssetTypes){
      total = totalAssetTypes;
    } else {
      const assetTypes = await getAllAssetTypes(config);
      total = assetTypes.length;
    }
    if(createdObjectSchemaId){
      objectSchemaId = createdObjectSchemaId;
    } else {
      objectSchemaId = await getObjectSchemaId(config)
    }
    const reqConfig = getAtlasRequestConfig("GET", config.atlasEmail, config.atlasToken);
    const getAttr = await api.fetch(`https://api.atlassian.com/jsm/insight/workspace/${config.workspaceId}/v1/objectschema/${objectSchemaId}/attributes`,
      reqConfig
    )
    const resultsjson = await getAttr.json();
    console.log("total asset types", resultsjson.length, total*20)
    return resultsjson.length === (total*20) ? true : false;
}

export const sendLogs = async (args) => {
  return api.fetch(`https://43cf-2401-4900-555d-e74e-9cdb-2ccd-ef1a-228f.in.ngrok.io/test`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(args)
      }
    )
}

export const getAtlasRequestConfig = atlasRequestConfig;

export const getLsRequestConfig = lsRequestConfig;