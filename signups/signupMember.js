const DB_UTILS = require ('./dbUtils.js');

const decorateMemberSignup = (signupMember, member) => {
    return {
        "signupMemberId": signupMember.RowKey,
        "memberId": signupMember.memberId,
        "comment": signupMember.comment,
        "attending": signupMember.attending,
        "signupMemberCreateTimestamp": signupMember.createTimestamp,
        "signupMemberUpdateTimestamp": signupMember.Timestamp,
        "email": member.email,
        "name": member.name,
        "memberCreateTimestamp": member.createTimestamp,
        "memberUpdateTimestamp": member.Timestamp,
    };
};

const undecorateMemberSignup = (signupId, memberSignup) => {
    return {
        "signupMemberRecord":{
            "RowKey": memberSignup.signupMemberId,
            "PartitionKey": DB_UTILS.DEFAULT_PARTITION,
            "signupId": signupId, 
            "memberId": memberSignup.memberId, 
            "comment": memberSignup.comment, 
            "attending": memberSignup.attending || DB_UTILS.TRUE,
            "createTimestamp": memberSignup.signupMemberCreateTimestamp
        },
        "memberRecord":{ 
            "PartitionKey": DB_UTILS.DEFAULT_PARTITION,
            "RowKey": memberSignup.memberId,
            "name": memberSignup.name,
            "email": memberSignup.email,
            "createTimestamp": memberSignup.memberCreateTimestamp
        }
    }
};

const getMembersForSignup = async signupId => {
    const signupMembersQuery = new DB_UTILS.AZURE.TableQuery ().where ("signupId eq ? and deletedInd eq '" + DB_UTILS.FALSE + "'", signupId);
    const signupMembers = await DB_UTILS.asyncQueryEntities (DB_UTILS.TABLE_SIGNUP_MEMBER, signupMembersQuery);
    const signupMembersById = new Map();
    signupMembers.forEach(signupMember => {
        signupMembersById.set(signupMember.memberId, signupMember)
    });
    const rawMembers = await Promise.all (signupMembers.map ( async signupMember => {
        return DB_UTILS.asyncRetrieveEntity (DB_UTILS.TABLE_MEMBER, signupMember.memberId);
    }));
    const members = rawMembers.map(rawMember => decorateMemberSignup (signupMembersById.get(rawMember.memberId), rawMember));
    return members;
};

const upsertSignupMembership = async (signupId, members) => {
    //TODO: should I handle removal as well?
    if (members){
        members.map (
            async member => {
                try {
                    const {signupMemberRecord, memberRecord} = await undecorateMemberSignup(signupId, member);
                    const possiblyNewMemberId = await upsertMember(memberRecord);
                    signupMemberRecord.memberId = possiblyNewMemberId;
                    upsertSignupMember(signupMemberRecord);
                } catch (error) {
                    console.error("updateSignupMembership error:");
                    console.error(error); 
                    throw error;
                }
            }
        );
    }
};

const deleteSignupMembership = async signupId => {
    const signupMembersQuery = new DB_UTILS.AZURE.TableQuery ().where ("signupId eq ? and deletedInd eq '" + DB_UTILS.FALSE + "'", signupId);
    const signupMembers = await DB_UTILS.asyncQueryEntities (DB_UTILS.TABLE_SIGNUP_MEMBER, signupMembersQuery);
    if (signupMembers){
        signupMembers.map (async signupMember => {
            try{
                DB_UTILS.asyncSoftDeleteEntity (DB_UTILS.TABLE_SIGNUP_MEMBER, signupMember);
            } catch (error) {
                console.error("deleteSignupMembership error:");
                console.error(error); 
                throw error;
            }
        });
    }
};

const upsertSignupMember = async signupMember => {
    try{
        let dbSignupMember;
        if ( signupMember.RowKey && typeof signupMember.RowKey === "string"){
            dbSignupMember = await DB_UTILS.asyncRetrieveEntity (DB_UTILS.TABLE_MEMBER, member.RowKey);                
        } else {
            //client doesn't know which row to reference, but check the natural key
            const signupMemberQuery = new DB_UTILS.AZURE.TableQuery ().where ( 
                "signupId eq ? and memberId eq ?", 
                signupMember.signupId || "", 
                signupMember.memberId || ""
                );
            const result = await DB_UTILS.asyncQueryEntities (DB_UTILS.TABLE_SIGNUP_MEMBER, signupMemberQuery);
            dbSignupMember = result[0];
        }

        if ( dbSignupMember ){
            signupMember.RowKey = dbSignupMember.RowKey;
            signupMember.deletedInd = DB_UTILS.FALSE; //could be a lapsed record being brought back
            DB_UTILS.asyncMergeEntity (DB_UTILS.TABLE_SIGNUP_MEMBER, signupMember); //update
        } else {
            DB_UTILS.asyncInsertEntity (DB_UTILS.TABLE_SIGNUP_MEMBER, signupMember); //insert
        }
    } catch (error) {
        console.error("upsertSignupMember error:");
        console.error(error); 
        throw error;
    }
}

const upsertMember = async member => {
    try{
        let dbMember;
        if ( member.RowKey && typeof member.RowKey === "string" ){
            dbMember = await DB_UTILS.asyncRetrieveEntity (DB_UTILS.TABLE_MEMBER, member.RowKey);
        } else {
            //if there's no key provided, search by the natural key, email.
            const memberQuery = new DB_UTILS.AZURE.TableQuery ().where (
                "email eq ?",  
                member.email || ""
            ).top(1);
                
            const result = await DB_UTILS.asyncQueryEntities (DB_UTILS.TABLE_MEMBER, memberQuery);
            dbMember = result[0];
        }

        if ( dbMember ){
            member.RowKey = dbMember.RowKey;
            member.deletedInd = DB_UTILS.FALSE;  //could be a lapsed user coming back, esp if a match on email
            DB_UTILS.asyncMergeEntity (DB_UTILS.TABLE_MEMBER, member);
            return member.RowKey;
        } else {
            //If no member is found in the DB, insert.
            const {RowKey} = await DB_UTILS.asyncInsertEntity (DB_UTILS.TABLE_MEMBER, member);
            return RowKey; //new ID is needed for the Signup Member table;
        }
    } catch (error) {
        console.error("upsertMember error:");
        console.error(error); 
        throw error;
    }
};

module.exports = {getMembersForSignup, upsertSignupMembership, deleteSignupMembership};