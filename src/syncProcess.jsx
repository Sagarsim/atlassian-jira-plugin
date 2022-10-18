import api, { storage } from '@forge/api';
import { getAtlasRequestConfig, getLsRequestConfig } from './helper';
import { Queue, InvocationError } from '@forge/events';
import Resolver from "@forge/resolver";
const queue = new Queue({ key: 'create-object-type-queue' });
const queue2 = new Queue({ key: 'create-object-attr-queue' });
const resolver = new Resolver();
const resolver2 = new Resolver();
export const createObjectSchema = async () => {
  try {
    const config = await storage.getSecret("lsConfig");
    // console.log("config ==>", config);
    let query = `{${config.selectedSites.map((st, i) => `site${i+1}: site(id: \"${st}\") {id assetTypes}`)}}`
    // console.log("query ==>", query);
    const allAssetTypes = await api.fetch("https://api.lansweeper.com/api/v2/graphql", 
      getLsRequestConfig(config.lsToken, query)
    );
    const assetTypes = await allAssetTypes.json();
    // console.log("assetTypes ==>", assetTypes);
    let finalAssetTypes = config.selectedSites.map((st, i) => {
      return assetTypes.data[`site${i+1}`].assetTypes;
    })
    finalAssetTypes = finalAssetTypes.flat();
    const queueCnt = Math.ceil(finalAssetTypes.length / 50);
    const queueArr = []; 
    for(let i = 0; i < queueCnt;i++){
      const fifty = finalAssetTypes.splice(0, 50);
      queueArr.push([...fifty.map(at => ({
          atlasEmail: config.atlasEmail,
          atlasToken: config.atlasToken,
          workspaceId: config.workspaceId,
          assetTypeName: at
        })
      )]);
    }
    // console.log("queueArr ==>", queueArr);
    const queuePromiseArr = queueArr.map(qArr => {
      return queue.push(qArr);
    })
    const createObjectTypeResp = await Promise.all(queuePromiseArr);
    await api.fetch(`https://yellow-toes-draw-106-205-237-250.loca.lt`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({message: "process started"})
      }
    )
    console.log("queue init")
  } catch(err){
    console.log("err ==>", err);
  }
}

resolver.define("create-object-type-listener", async ({ payload, context }) => {
  try {
    if (payload.retryContext) {
      const { retryCount, retryReason, retryData } = payload.retryContext;
      console.log("retry info ==>", retryCount, retryReason)
      await api.fetch(`https://yellow-toes-draw-106-205-237-250.loca.lt`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({retryCount, retryReason})
        }
      )
    } else {

      // process the event
      const reqConfig = getAtlasRequestConfig("POST", payload.atlasEmail, payload.atlasToken);
      reqConfig.body = JSON.stringify({
          "inherited": false,
          "abstractObjectType": false,
          "objectSchemaId": "5",
          "iconId": "87",
          "name": payload.assetTypeName
      })
      const createObjectResponse = await api.fetch(`https://api.atlassian.com/jsm/insight/workspace/${payload.workspaceId}/v1/objecttype/create`,
          reqConfig
      );
      // console.log(`createObjectResponse ==> ${createObjectResponse.status}`);
      const createObjectResponseResp = await createObjectResponse.json();
      const objectTypeId = createObjectResponseResp.id;

      await queue2.push({
            atlasEmail: payload.atlasEmail,
            atlasToken: payload.atlasToken,
            workspaceId: payload.workspaceId,
            objectTypeId,
            count: 0
      });
    }
  } catch(err){
    console.log("err ==>", err);
    await api.fetch(`https://yellow-toes-draw-106-205-237-250.loca.lt`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({err})
      }
    )
  }
});

resolver2.define("create-object-attr-listener", async ({ payload, context }) => {
  try {
    if (payload.retryContext) {
      const { retryCount, retryReason, retryData } = payload.retryContext;
      console.log("attr retry info ==>", retryCount, retryReason)
      await api.fetch(`https://angry-grapes-tickle-103-108-207-58.loca.lt/test`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({retryCount, retryReason})
          }
        )
    } 
    for(let i = payload.count ; i < payload.count + 5 ;i++){

      const reqConfig = getAtlasRequestConfig("POST", payload.atlasEmail, payload.atlasToken);
        reqConfig.body = JSON.stringify({
                "name": `attr${i}`,
                "type": "0",
                "defaultTypeId": "0"
            });
        const createObjectAttrResp = await api.fetch(`https://api.atlassian.com/jsm/insight/workspace/${payload.workspaceId}/v1/objecttypeattribute/${payload.objectTypeId}`,
          reqConfig
        )
        if(createObjectAttrResp.status === 429 || createObjectAttrResp.status !== 201){
          console.log(`createObjectAttrResp ==>`, createObjectAttrResp.status);
          await api.fetch(`https://yellow-toes-draw-106-205-237-250.loca.lt`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json"
              },
              body: JSON.stringify({message: "30 done"})
            }
          )
        }
    }

      if(payload.count < 30) {
          const eventId = await queue2.push({
            atlasEmail: payload.atlasEmail,
            atlasToken: payload.atlasToken,
            workspaceId: payload.workspaceId,
            objectTypeId: payload.objectTypeId,
            count: payload.count+5
         });
      } else {
        console.log("30 done ===>")
        await api.fetch(`https://yellow-toes-draw-106-205-237-250.loca.lt`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({message: "30 done"})
          }
        )
      }
  } catch(err){
    console.log("attr err ==>", err, payload.count)
    await api.fetch(`https://yellow-toes-draw-106-205-237-250.loca.lt`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({error: err})
        }
      )
    return new InvocationError({
      retryAfter: 100,
      retryReason: "Retry attr event",
      retryData: payload
    });
  }
});



export const createObjectTypeHandler = resolver.getDefinitions();
export const createObjectAttrHandler = resolver2.getDefinitions();