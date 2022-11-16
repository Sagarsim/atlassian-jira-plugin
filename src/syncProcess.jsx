import api, { storage, route, startsWith } from '@forge/api';
import { getAtlasRequestConfig, getLsRequestConfig, sendLogs, getObjectSchemaId, validateObjectSchema, getAllAssetTypes } from './helper';
import { Queue, InvocationError } from '@forge/events';
import Resolver from "@forge/resolver";
import { assetAttributes } from './constants';
import Randomstring from 'randomstring';
const queue = new Queue({ key: 'create-object-type-queue' });
const queue2 = new Queue({ key: 'create-object-attr-queue' });
const queue3 = new Queue({ key: 'get-object-attr-queue' });
const queue4 = new Queue({ key: 'create-object-init-queue' });
const queue5 = new Queue({ key: 'create-object-queue' });
const queue6 = new Queue({ key: 'create-object-2-queue' });
const resolver = new Resolver();
const resolver2 = new Resolver();
const resolver3 = new Resolver();
const resolver4 = new Resolver();
const resolver5 = new Resolver();
const resolver6 = new Resolver();

export const createObjectSchema = async () => {
  try {
    const config = await storage.getSecret("lsConfig");
    let objectSchemaId = await getObjectSchemaId(config);
    console.log("objectSchemaId ==>", objectSchemaId);
    const filteredAssetTypes = await getAllAssetTypes(config);
    console.log("filteredAssetTypes ==>", filteredAssetTypes.length)
    const queueCnt = Math.ceil(filteredAssetTypes.length / 50);
    const queueArr = []; 
    for(let i = 0; i < queueCnt;i++){
      const fifty = filteredAssetTypes.splice(0, 50);
      queueArr.push([...fifty.map(at => ({
          atlasEmail: config.atlasEmail,
          atlasToken: config.atlasToken,
          workspaceId: config.workspaceId,
          assetTypeName: at,
          objectSchemaId
        })
      )]);
    }
    // console.log("queueArr ==>", queueArr);
    const queuePromiseArr = queueArr.map(qArr => {
      return queue.push(qArr);
    })
    await Promise.all(queuePromiseArr);
    await sendLogs({success: true, message: "queue init"})
    console.log("queue init")
  } catch(err){
    await sendLogs({success: false, error: err})
    console.log("err ==>", err);
  }
}

resolver.define("create-object-type-listener", async ({ payload, context }) => {
  try {
    if (payload.retryContext) {
      const { retryCount, retryReason, retryData } = payload.retryContext;
      console.log("retry info ==>", retryCount, retryReason)
      await sendLogs({success: false, retryCount, retryReason, context: "create-object-type-listener"})
    } else {

      // process the event
      const reqConfig = getAtlasRequestConfig("POST", payload.atlasEmail, payload.atlasToken);
      reqConfig.body = JSON.stringify({
          "inherited": false,
          "abstractObjectType": false,
          "objectSchemaId": payload.objectSchemaId,
          "iconId": "87",
          "name": payload.assetTypeName
      })
      const createObjectResponse = await api.fetch(`https://api.atlassian.com/jsm/insight/workspace/${payload.workspaceId}/v1/objecttype/create`,
          reqConfig
      );
      if(createObjectResponse.status !== 201){

        console.log(`createObjectResponse ==> ${createObjectResponse.status}`);
        await sendLogs({success: true, asset_type_status: createObjectResponse.status})
      }
      const createObjectResponseResp = await createObjectResponse.json();
      const objectTypeId = createObjectResponseResp.id;

      await queue2.push({
            atlasEmail: payload.atlasEmail,
            atlasToken: payload.atlasToken,
            workspaceId: payload.workspaceId,
            objectTypeId,
            objectSchemaId: payload.objectSchemaId,
            count: 0
      }, {
        delayInSeconds: 20
      });
    }
  } catch(err){
    console.log("err ==>", err);
    await sendLogs({success: false, error: err.message})
  }
});

resolver2.define("create-object-attr-listener", async ({ payload, context }) => {
  try {
    if (payload.retryContext){
      const { retryCount, retryReason, retryData } = payload.retryContext;
      await sendLogs({success: false, retryCount, retryReason, context: "create-object-attr-listener"})
    } else {

      for(let i = payload.count ; i < payload.count + 2 ;i++){
        if(i < assetAttributes.length){
          const reqConfig = getAtlasRequestConfig("POST", payload.atlasEmail, payload.atlasToken);
          reqConfig.body = JSON.stringify(assetAttributes[i]);
          const createObjectAttrResp = await api.fetch(`https://api.atlassian.com/jsm/insight/workspace/${payload.workspaceId}/v1/objecttypeattribute/${payload.objectTypeId}`,
            reqConfig
          )
          if(createObjectAttrResp.status !== 201){
            await sendLogs({success: false, attr_status: createObjectAttrResp, payload})
          }
        }
      }
        if(payload.count < (assetAttributes.length - 1)) {
            await queue2.push({
              atlasEmail: payload.atlasEmail,
              atlasToken: payload.atlasToken,
              workspaceId: payload.workspaceId,
              objectTypeId: payload.objectTypeId,
              objectSchemaId: payload.objectSchemaId,
              count: payload.count+2
           }, {
            delayInSeconds: 20
           });
        } else {
          await sendLogs({success: true, message: `16 done---`})
          const isSchemaValid = await validateObjectSchema(config, null, objectSchemaId);
          console.log("isSchemaValid ==>", isSchemaValid);
          if(isSchemaValid){
            startAssetCreation();
          } 
        }
    }
  } catch(err){
    console.log("attr err ==>", err, payload.count)
    await sendLogs({success: false, error: err.message})
    return new InvocationError({
      retryAfter: 100,
      retryReason: "Retry attr event",
      retryData: payload
    });
  }
});

export const startAssetCreation = async () => {
  try {
    const config = await storage.getSecret("lsConfig");
    const objectSchemaId = await getObjectSchemaId(config);
    const isSchemaValid = await validateObjectSchema(config, null, objectSchemaId);
    console.log("isSchemaValid ==>", isSchemaValid);
    if(!isSchemaValid){
      // createObjectSchema();
    } else {
      const reqConfig = getAtlasRequestConfig("GET", config.atlasEmail, config.atlasToken);
      const getAssetTypes = await api.fetch(`https://api.atlassian.com/jsm/insight/workspace/${config.workspaceId}/v1/objectschema/${objectSchemaId}/objecttypes/flat`,
          reqConfig
      );
      const resp = await getAssetTypes.json();
      const payloadArr = resp.map(at => ({
        assetTypeName: at.name,
        assetTypeId: at.id,
        totalAssets: 0,
        totalSyncedAssets: 0
      }))
      await storage.set("assetTypeStats", payloadArr);
      
      const queueCnt = Math.ceil(payloadArr.length / 50);
      const queueArr = []; 
      for(let i = 0; i < queueCnt;i++){
        const fifty = payloadArr.splice(0, 50);
        queueArr.push([...fifty.map(at => {
            return { 
              assetTypeName: at.assetTypeName,
              assetTypeId: at.assetTypeId,
              atlasEmail: config.atlasEmail,
              atlasToken: config.atlasToken,
              workspaceId: config.workspaceId,
              selectedSites: config.selectedSites,
              lsToken: config.lsToken
          }
        }
        )]);
      }
      queueArr.map(async que => {
        await queue3.push(que);
      })
      await sendLogs({success: true, message: "create object queue init"})
    }
  } catch(err) {
    await sendLogs({success: false, error: err.message})
    console.log("err ==>", err);
  }
}

resolver3.define("get-object-attr-listener", async ({ payload, context }) => {
  try {
    if (payload.retryContext){
      const { retryCount, retryReason, retryData } = payload.retryContext;
      await sendLogs({success: false, retryCount, retryReason, context: "get-object-attr-listener"})
    }
    const reqConfig = getAtlasRequestConfig("GET", payload.atlasEmail, payload.atlasToken);
    const getAssetTypeAttr = await api.fetch(`https://api.atlassian.com/jsm/insight/workspace/${payload.workspaceId}/v1/objecttype/${payload.assetTypeId}/attributes`,
        reqConfig
    );
    const resp = await getAssetTypeAttr.json();
    const createObjAttrArr = resp.map(attr => {
      return {[attr.name]: `${attr.id}`}
    })

    const finalObj = {
      assetTypeName: payload.assetTypeName,
      assetTypeId: payload.assetTypeId,
      atlasEmail: payload.atlasEmail,
      atlasToken: payload.atlasToken,
      workspaceId: payload.workspaceId,
      lsToken: payload.lsToken,
      selectedSites: payload.selectedSites,
      limit: 100,
      page: "FIRST",
      createdCnt: 0,
      objectAttributes: createObjAttrArr
    }

    await queue4.push(finalObj);
    // await sendLogs({success: true, message: finalObj})
  } catch(err) {
    await sendLogs({success: false, error: err.message})
  }
})

resolver4.define("create-object-init-listener", async ({ payload, context }) => {
  try {
    if (payload.retryContext){
      const { retryCount, retryReason, retryData } = payload.retryContext;
      await sendLogs({success: false, retryCount, retryReason, context: "create-object-init-listener"})
    } else {

      const query = `{ site(id: \"${payload.selectedSites[1].id}\"){ assetResources( assetPagination: { limit: ${payload.limit}, page: ${payload.page}${payload.cursor ? `, cursor: "${payload.cursor}"` : ""}}, fields: [ \"assetBasicInfo.name\", \"assetBasicInfo.type\", \"url\" ], filters: { conjunction: AND, conditions: [ { operator: LIKE, path: \"assetBasicInfo.type\", value: \"${payload.assetTypeName}\" } ] } ) { total pagination { limit current next page } items } } }`;
      const allObjects = await api.fetch("https://api.lansweeper.com/api/v2/graphql", 
        getLsRequestConfig(payload.lsToken, query)
      );
      const allObjectsJson = await allObjects.json();
      const createObjectArr = allObjectsJson.data.site.assetResources.items.map(ast => {
        return {
          assetKey: ast.key,
          assetObj: {
            objectTypeId: payload.assetTypeId,
            attributes: [
              {
                "objectTypeAttributeId": payload.objectAttributes.find(obj => Object.keys(obj)[0] === "Name")["Name"],
                "objectAttributeValues": [
                  {
                    "value": ast.assetBasicInfo.name
                  }
                ]
              },
              {
                "objectTypeAttributeId": payload.objectAttributes.find(obj => Object.keys(obj)[0] === "Key")["Key"],
                "objectAttributeValues": [
                  {
                    "value": ast.key
                  }
                ]
              }
            ]
        }}
      })
      // await sendLogs({success: true, message: createObjectArr[0]})
      const queuePayloadArr = createObjectArr.map(async coj => {
        const obj = {
          atlasEmail: payload.atlasEmail,
            atlasToken: payload.atlasToken,
            workspaceId: payload.workspaceId,
            createObjectJson: JSON.stringify(coj.assetObj)
        }
        return storage.set(`asset:${Randomstring.generate()}`, obj)
        
      })
      await Promise.all(queuePayloadArr);
      if((payload.createdCnt + createObjectArr.length) > 1050){
        await queue5.push({cursor: '', count: 0}, {
          delayInSeconds: 10
        })
        console.log("stored ==>", payload.createdCnt + createObjectArr.length)
      }
      await sendLogs({success: true, message: payload.createdCnt + createObjectArr.length});
      if((payload.createdCnt + createObjectArr.length) < allObjectsJson.data.site.assetResources.total){
        await queue4.push({
          assetTypeName: payload.assetTypeName,
          assetTypeId: payload.assetTypeId,
          atlasEmail: payload.atlasEmail,
          atlasToken: payload.atlasToken,
          workspaceId: payload.workspaceId,
          lsToken: payload.lsToken,
          selectedSites: payload.selectedSites,
          limit: 100,
          page: (allObjectsJson.data.site.assetResources.total - payload.createdCnt + createObjectArr.length) > 100 ? "NEXT" : "LAST",
          cursor: allObjectsJson.data.site.assetResources.pagination.next,
          createdCnt: payload.createdCnt + createObjectArr.length,
          objectAttributes: payload.objectAttributes
        }, {delayInSeconds: 10})
      }
    }
  } catch(err) {
    await sendLogs({success: false, error: err.message})
  }
})

resolver5.define("create-object-listener", async ({ payload, context }) => {
  try {
    if (payload.retryContext){
      const { retryCount, retryReason, retryData } = payload.retryContext;
      await sendLogs({success: false, retryCount, retryReason, context: "create-object-listener"})
    } 
    let data;
    if(payload.cursor.length > 0){
      data = await storage.query().where("key", startsWith("asset:")).limit(20).cursor(payload.cursor).getMany();
    } else {
      data = await storage.query().where("key", startsWith("asset:")).limit(20).getMany();
    }
    console.log("fetch stored ==>", data);
    data.results.map(async rs => {
      await queue6.push(rs.value)
    })
    if(data.nextCursor){
      await queue5.push({cursor: data.nextCursor, count: payload.count + 20}, {
        delayInSeconds: 10
      })
      console.log(`${payload.count + 20} done ==>`)
      await sendLogs({success: true, message: `${payload.count + 20} done ==>`})
    }
  } catch(err) {
    await sendLogs({success: false, error: err.message})
  }
})

resolver6.define("create-object-2-listener", async ({ payload, context }) => {
  try {
    if (payload.retryContext){
      const { retryCount, retryReason, retryData } = payload.retryContext;
      await sendLogs({success: false, retryCount, retryReason, context: "create-object-listener"})
    }
    
      const reqConfig = getAtlasRequestConfig("POST", payload.atlasEmail, payload.atlasToken);
      reqConfig.body = payload.createObjectJson;
      reqConfig.timeout = 20000;
      const createResp = await api.fetch(`https://api.atlassian.com/jsm/assets/workspace/${payload.workspaceId}/v1/object/create`,
          reqConfig
      );
      const hdrs = {};
      createResp.headers.forEach((value, key) => {
        hdrs[key] = value;
      })
      if(createResp.status !== 201){
        await sendLogs({success: true, status: createResp.status, payload})
      }
  } catch(err) {
    await sendLogs({success: false, error: err.message})
  }
})


export const createObjectTypeHandler = resolver.getDefinitions();
export const createObjectAttrHandler = resolver2.getDefinitions();
export const getObjectAttrHandler = resolver3.getDefinitions();
export const createObjectInitHandler = resolver4.getDefinitions();
export const createObjectHandler = resolver5.getDefinitions();
export const createObject2Handler = resolver6.getDefinitions();