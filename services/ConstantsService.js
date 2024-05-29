import { updateBalanceInDatabase } from "./DbUtils"

const updateBalance=async(newBalance)=>{

    await updateBalanceInDatabase(newBalance);
    return newBalance
}

export {updateBalance}