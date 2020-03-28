const DB_UTILS = require ('./dbUtils.js');

const decorateMemberSignup = async (signupMember, member) => {
    return {
        "signupMemberId": signupMember.RowKey,
        "signupId": signupMember.signupId,
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

const undecorateMemberSignup = async (memberSignup) => {
    return {
        "signupMemberRecord":{
            "RowKey": memberSignup.signupMemberId,
            "PartitionKey": DB_UTILS.DEFAULT_PARTITION,
            "signupId": memberSignup.signupId, 
            "memberId": memberSignup.memberId, 
            "comment": memberSignup.comment, 
            "attending": memberSignup.attending || "Y",
            //TODO
            "createTimestamp": memberSignup.signupMemberCreateTimestamp,
        },
        "memberRecord":{ 
            "PartitionKey": DB_UTILS.DEFAULT_PARTITION,
            "RowKey": memberSignup.memberId,
            "name": memberSignup.name,
            //TODO
            "createTimestamp": memberSignup.memberCreateTimestamp || new Date(),
        }
    }
};

const getMembersForSignup = async (signupId) => {
    const signupMembersQuery = new DB_UTILS.AZURE.TableQuery ().where ("signupId eq ? and attending eq 'Y'", signupId);
    const signupMembers = await DB_UTILS.asyncQueryEntities (TABLE_SIGNUP_MEMBER, signupMembersQuery);
    const members = await Promise.all (signupMembers.map ((signupMember) => 
        decorateMemberSignup (signupMember, getMember (signupMember.memberId))));
    return members;
};

const getMember = async (memberId) => {
    try{
        return await DB_UTILS.asyncRetrieveEntity (TABLE_MEMBER, memberId);
    } catch (error) {
        console.error ("getMember error:");
        console.error (error);
        throw error;
    }
};

const upsertSignupMembership = async (members) => {
    if (members){
        members.map (
            async member => {
                try {
                    const {signupMemberRecord, memberRecord} = await undecorateMemberSignup(member);

                    DB_UTILS.asyncInsertOrMergeEntity (TABLE_MEMBER, memberRecord);
                    DB_UTILS.asyncInsertOrMergeEntity (TABLE_SIGNUP_MEMBER, signupMemberRecord);
                } catch (error) {
                    console.error("updateSignupMembership error:");
                    console.error(error); 
                    throw error;
                }
            });
    }
};

 module.exports = {decorateMemberSignup, undecorateMemberSignup, getMembersForSignup, getMember, upsertSignupMembership};