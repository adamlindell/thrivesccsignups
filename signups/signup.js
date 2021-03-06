const DB_UTILS = require ('./dbUtils.js');
const SIGNUP_MEMBER = require ('./signupMember.js');


const createSignup = async signup => {
    try{
        const {dbSignup, members} = undecorateSignup (signup);
        const {RowKey} = await DB_UTILS.asyncInsertEntity ( DB_UTILS.TABLE_SIGNUP, dbSignup);
        SIGNUP_MEMBER.upsertSignupMembership (RowKey, members);
    } catch (error) {
        console.error("createSignup error:");
        console.error(error);
        throw error;
    }
};

const deleteSignup = async signupId => {
    try{
        const dbSignup = getSignup (signupId);
        if (dbSignup){
            DB_UTILS.asyncSoftDeleteEntity (DB_UTILS.TABLE_SIGNUP, dbSignup);
            SIGNUP_MEMBER.deleteSignupMembership (signup.signupId, members);
        }
    } catch (error) {
        console.error("deleteSignup error:");
        console.error(error);
        throw error;
    }
}

const getAllSignups = async () => {
    try{
        const signupQuery = new DB_UTILS.AZURE.TableQuery ().where ("deletedInd eq '" + DB_UTILS.FALSE + "'");
        const signupsData = await DB_UTILS.asyncQueryEntities (DB_UTILS.TABLE_SIGNUP, signupQuery);
        const signups = await Promise.all (signupsData.map (decorateSignup));
        return signups;
    } catch (error) {
        console.error("getAllSignups error:");
        console.error(error);
        throw error;
    }
};

const getSignup = async signupId => {
    try{
        const signup = await DB_UTILS.asyncRetrieveEntity(DB_UTILS.TABLE_SIGNUP, signupId);
        return await decorateSignup (signup);
    } catch (error) {
        console.error("getSignup error:");
        console.error(error);
        throw error;
    }
};

const decorateSignup = async rawSignup => {
    const signup = {...rawSignup};
    const signupId = rawSignup.RowKey;
    const members = await SIGNUP_MEMBER.getMembersForSignup(signupId);
    signup.updateTimestamp = signup.Timestamp;

    //remove db-specific properties
    delete signup.RowKey;
    delete signup.PartitionKey;
    delete signup.Timestamp;
    delete signup.deletedInd;
    
    return { signupId, ...signup, members};
}; 

const undecorateSignup = signup => {
    const dbSignup = {...signup};
    const members = dbSignup.members;
    
    dbSignup.RowKey = dbSignup.signupId;
    dbSignup.PartitionKey = DB_UTILS.DEFAULT_PARTITION;
    
    delete dbSignup.signupId;
    delete dbSignup.members;
    
    return {dbSignup, members};
};

const updateSignup = async signup => {
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

module.exports = {createSignup, getAllSignups, getSignup, updateSignup, deleteSignup};