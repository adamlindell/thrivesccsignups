const DB_UTILS = require ('./dbUtils.js');

const decorateMemberSignup = async (signupMember, member) => {
    return {
        "signupMemberId": signupMember.RowKey,
        "memberId": signupMember.memberId,
        "comment": signupMember.comment,
        "attending": signupMember.attending,
        "signupMemberCreateTimestamp": signupMember.createTimestamp,
        "signupMemberUpdateTimestamp": signupMember.Timestamp,
        "name": member.name,
        "memberCreateTimestamp": member.createTimestamp,
        "memberUpdateTimestamp": member.Timestamp,
    };
};

const undecorateMemberSignup = async (signupId, memberSignup) => {
    return {
        "signupMemberRecord":{
            "RowKey": memberSignup.signupMemberId,
            "PartitionKey": DB_UTILS.DEFAULT_PARTITION,
            "signupId": signupId, 
            "memberId": memberSignup.memberId, 
            "comment": memberSignup.comment, 
            "attending": memberSignup.attending || "Y",
            "createTimestamp": memberSignup.signupMemberCreateTimestamp
        },
        "memberRecord":{ 
            "PartitionKey": DB_UTILS.DEFAULT_PARTITION,
            "RowKey": memberSignup.memberId,
            "name": memberSignup.name,
            "createTimestamp": memberSignup.memberCreateTimestamp
        }
    }
};

const getMembersForSignup = async signupId => {
    const signupMembersQuery = new DB_UTILS.AZURE.TableQuery ().where ("signupId eq ? and attending eq 'Y'", signupId);
    const signupMembers = await DB_UTILS.asyncQueryEntities (DB_UTILS.TABLE_SIGNUP_MEMBER, signupMembersQuery);
    const members = await Promise.all (signupMembers.map (signupMember => 
        decorateMemberSignup (signupMember, DB_UTILS.asyncRetrieveEntity (DB_UTILS.TABLE_MEMBER, signupMember.memberId))));
    return members;
};

const upsertSignupMembership = async (signupId, members) => {
    if (members){
        members.map (
            async member => {
                try {
                    const {signupMemberRecord, memberRecord} = await undecorateMemberSignup(signupId, member);

                    const signupMemberExists = await DB_UTILS.asyncRetrieveEntity (DB_UTILS.TABLE_SIGNUP_MEMBER, signupMemberRecord.RowKey);
                    if ( signupMemberExists ){
                        DB_UTILS.asyncMergeEntity (DB_UTILS.TABLE_SIGNUP_MEMBER, signupMember); //update
                    } else {
                        DB_UTILS.asyncInsertEntity (DB_UTILS.TABLE_SIGNUP_MEMBER, signupMemberRecord); //insert
                    }

                    const memberExists = await DB_UTILS.asyncRetrieveEntity (DB_UTILS.TABLE_MEMBER, memberRecord.RowKey);
                    if ( memberExists ){
                        DB_UTILS.asyncMergeEntity (DB_UTILS.TABLE_MEMBER, memberRecord);
                    } else {
                        DB_UTILS.asyncInsertEntity (DB_UTILS.TABLE_MEMBER, memberRecord);
                    }

                } catch (error) {
                    console.error("updateSignupMembership error:");
                    console.error(error); 
                    throw error;
                }
            }
        );
    }
};

module.exports = {getMembersForSignup, upsertSignupMembership};