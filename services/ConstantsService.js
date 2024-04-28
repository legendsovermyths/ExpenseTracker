import { updateBalanceInDatabase } from "./dbUtils"

const updateBalance=async(newBalance)=>{

    await updateBalanceInDatabase(newBalance);
    console.log(newBalance);
    return newBalance
}

export {updateBalance}