import api, {route, storage} from '@forge/api';

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

export const getSites = async (token) => {
  try {
    const allSites = await api.fetch("https://api.lansweeper.com/api/v2/graphql", 
      lsRequestConfig(token, "{ authorizedSites { sites { id name } } }")
    );
    const sitesJson = await allSites.json();
    return sitesJson.data.authorizedSites.sites ? sitesJson.data.authorizedSites.sites : []
  } catch(err) {
    return [];
  }
}

export const validateAtlasToken = async (username, password) => {
  try {
    const res = await api.asUser().requestJira(route`/rest/servicedeskapi/insight/workspace`);
    const workspaceData = await res.json();
    const workspaceId = workspaceData.values[0].workspaceId;
    const reqConfig = atlasRequestConfig("GET", username, password);
    const configStatus = await api.fetch(`https://api.atlassian.com/jsm/insight/workspace/${workspaceId}/v1/config/statustype`,
      reqConfig
    );
    return configStatus.status === 200 ? workspaceId : ""
  } catch(err) {
    console.log("err ==>", err);
    return "";
  }
}

export const sendLogs = async (args) => {
  return api.fetch(`https://3ed1-103-240-170-197.in.ngrok.io/test`,
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