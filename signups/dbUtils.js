
const AZURE = require('azure-storage'); //import?
const DEFAULT_PARTITION = "default";

function cleanUpAzureDBResponse (azureResponse){
    const result = {};
    Object.keys(azureResponse).map( key => {
        if (key === ".metadata"){ //metadata is only useful within a db transaction, so skip it
            return;
        }

        if (Array.isArray (azureResponse[key])){
            result[key] = azureResponse[key].map (cleanUpAzureDBResponse);
        } else {
        result[key] = azureResponse[key]._;
        }               
    });
    return result;
}


module.exports = {
    AZURE,
    asyncRetrieveEntity: function (tableName, rowId, partitionKeyName = DEFAULT_PARTITION){
        return new Promise((resolve, reject) => AZURE.createTableService().retrieveEntity(tableName, partitionKeyName, rowId, (error, result, response) => {
            if(error){
                reject({error, response});
            } else {
                resolve (cleanUpAzureDBResponse (result));
            }
        }));
    },
    asyncQueryEntities: function (tableName, query, continuationToken){
        return new Promise ((resolve, reject) => AZURE.createTableService().queryEntities(tableName, query, continuationToken, function(error, result, response) {
            if(error){
                reject({error, response});
            } else {
                if (result.entries){
                    resolve(result.entries.map(cleanUpAzureDBResponse));
                } else {
                    resolve(result.entries);
                }
            
            }
        }));
    },
    asyncMergeEntity: function (tableName, entity, options = undefined){
        return new Promise ((resolve, reject) => AZURE.createTableService().mergeEntity(tableName, entity, options, function(error, result, response) {
            if(error){
                reject({error, response});
            } else {
                resolve(result); //successfully merged element
            }
        }));
    },
    asyncInsertOrMergeEntity: function (tableName, entity, options = undefined){
        return new Promise ((resolve, reject) => AZURE.createTableService().insertOrMergeEntity(tableName, entity, options, function(error, result, response) {
            if(error){
                reject({error, response});
            } else {
                resolve(result); //successfully persisted element
            }
        }));
    },
    asyncDeleteEntity: function (tableName, entity, options = undefined){
        return new Promise ((resolve, reject) => AZURE.createTableService().delete(tableName, entity, options, function(error, result, response) {
            if(error){
                reject({error, response});
            } else {
                resolve(result); //successfully deleted element
            }
        }));
    },
    initTable: function (tableName){
        AZURE.createTableService().createTableIfNotExists(tableName, function(error, result, response){
            if(error){
                context.error("create " + tableName + "table:");
                context.error(error);
            }
        });
    },
}









