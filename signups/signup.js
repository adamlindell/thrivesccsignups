const DB_UTILS = require ('./dbUtils.js');
const SIGNUP_MEMBER = require ('./signupMember.js');


const createSignup = async (signup) => {
    try{
        const {dbSignup, members} = undecorateSignup (signup);
        DB_UTILS.asyncInsertEntity ( DB_UTILS.TABLE_SIGNUP, dbSignup);
        SIGNUP_MEMBER.upsertSignupMembership (signup.signupId, members);
    } catch (error) {
        console.error("createSignup error:");
        console.error(error);
        throw error;
    }
};

const getAllSignups = async () => {
    try{
        const signupsData = await DB_UTILS.asyncQueryEntities (DB_UTILS.TABLE_SIGNUP, new DB_UTILS.AZURE.TableQuery());
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
        const signup = await DB_UTILS.asyncRetrieveEntity(DB_UTILS.TABLE_SIGNUP, signupId);
        return await decorateSignup (signup);
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
    signup.updateTimestamp = signup.Timestamp;

    delete signup.RowKey;
    delete signup.PartitionKey;
    delete signup.Timestamp;
    
    return { signupId, ...signup, members};
}; 

const undecorateSignup = (signup) => {
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
        
        await SIGNUP_MEMBER.upsertSignupMembership (signup.signupId, members);
        return await DB_UTILS.asyncMergeEntity (DB_UTILS.TABLE_SIGNUP, dbSignup);
    } catch (error) {
        console.error ("updateSignup error:");
        console.error (error);
        throw error;
    }
};

module.exports = {createSignup, getAllSignups, getSignup, updateSignup};