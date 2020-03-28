
const AZURE = require('azure-storage');
const { v4: UUIDV4 } = require('uuid');

const DEFAULT_PARTITION = "default";

const TABLE_SIGNUP = "signup";
const TABLE_MEMBER = "member";
const TABLE_SIGNUP_MEMBER = "signupMember";

const cleanUpAzureDBResponse = (azureResponse) => {
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
};

const initTable = (tableName) => {
    AZURE.createTableService().createTableIfNotExists(tableName, (error, result, response) => {
        if(error){
            context.error("create " + tableName + "table:");
            context.error(error);
        }
    });
};

const initDB = () => {
    initTable(TABLE_SIGNUP);
    initTable(TABLE_SIGNUP_MEMBER);
    initTable(TABLE_MEMBER);
};

const asyncRetrieveEntity = (tableName, rowId, partitionKeyName = DEFAULT_PARTITION) => {
    return new Promise((resolve, reject) => AZURE.createTableService().retrieveEntity(tableName, partitionKeyName, rowId, (error, result, response) => {
        if(error){
            reject({error, response});
        } else {
            resolve (cleanUpAzureDBResponse (result));
        }
    }));
};

const asyncQueryEntities = (tableName, query, continuationToken) => {
    return new Promise ((resolve, reject) => AZURE.createTableService().queryEntities(tableName, query, continuationToken, (error, result, response) => {
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
};

const asyncMergeEntity = (tableName, entity, options = undefined) => {
    //don't update the createTimestamp
    delete entity.createTimestamp;
    
    return new Promise ((resolve, reject) => AZURE.createTableService().mergeEntity(tableName, entity, options, (error, result, response) =>  {
        if(error){
            reject({error, response});
        } else {
            resolve(result); //successfully merged element
        }
    }));
};

const asyncInsertEntity = (tableName, entity, options = undefined) => {
    //generate an ID and establish a createTimestamp
    entity.RowKey = UUIDV4();
    entity.createTimestamp = new Date();

    return new Promise ((resolve, reject) => AZURE.createTableService().insertEntity(tableName, entity, options, (error, result, response) =>  {
        if(error){
            reject({error, response});
        } else {
            resolve(result); //successfully persisted element
        }
    }));
};

const asyncDeleteEntity = (tableName, entity, options = undefined) => {
    return new Promise ((resolve, reject) => AZURE.createTableService().delete(tableName, entity, options, (error, result, response) => {
        if(error){
            reject({error, response});
        } else {
            resolve(result); //successfully deleted element
        }
    }));
};


//Make sure that the tables at least exist
initDB();

module.exports = {
    AZURE,
    DEFAULT_PARTITION,
    TABLE_MEMBER,
    TABLE_SIGNUP,
    TABLE_SIGNUP_MEMBER,
    initDB,
    asyncRetrieveEntity,
    asyncQueryEntities,
    asyncMergeEntity,
    asyncInsertEntity,
    asyncDeleteEntity,
};









