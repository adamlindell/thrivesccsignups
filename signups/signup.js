const DB_UTILS = require ('./dbUtils.js');
const SIGNUP_MEMBER = require ('./signupMember.js');

const createSignup = async (signup) => {
    //const response = await client.database(databaseName).container(containerName).items.create(signup);
    //return response;
};

const getAllSignups = async () =>{
    try{
        const signupsData = await DB_UTILS.asyncQueryEntities (TABLE_SIGNUP, new DB_UTILS.AZURE.TableQuery());
        const signups = await Promise.all (signupsData.map (decorateSignup));
        return signups;
    } catch (error) {
        console.error("getAllSignups error:");
        console.error(error);
        throw error;
    }
};

const getSignup = async (signupId) => {
    try{
        const signup = await DB_UTILS.asyncRetrieveEntity(TABLE_SIGNUP, signupId);
        return decorateSignup (signup);
    } catch (error) {
        console.error("getSignup error:");
        console.error(error);
        throw error;
    }
};

const decorateSignup = async (rawSignup) => {
    const signup = {...rawSignup};
    const signupId = rawSignup.RowKey;
    const members = await SIGNUP_MEMBER.getMembersForSignup(signupId);
    
    delete signup.RowKey;
    delete signup.PartitionKey;
    
    return { signupId, ...signup, members};
}; 

const undecorateSignup = async (signup) => {
    const dbSignup = {...signup};
    const members = dbSignup.members;
    
    dbSignup.RowKey = dbSignup.signupId;
    dbSignup.PartitionKey = DB_UTILS.DEFAULT_PARTITION;
    
    delete dbSignup.signupId;
    delete dbSignup.members;
    
    return {dbSignup, members};
};

const updateSignup = async (signup) => {
    try{
        const {dbSignup, members}  = await undecorateSignup(signup);
        delete dbSignup.createTimestamp; //createTimestamp is not updateable.
        
        await SIGNUP_MEMBER.upsertSignupMembership (members);
        return await DB_UTILS.asyncMergeEntity (TABLE_SIGNUP, dbSignup);
    } catch (error) {
        console.error ("updateSignup error:");
        console.error (error);
        throw error;
    }
};

module.exports = {createSignup, getAllSignups, getSignup, decorateSignup, undecorateSignup, updateSignup};