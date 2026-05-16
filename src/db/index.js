import mongoose from "mongoose"
import { MONGO_DB } from "../constants.js"

const database = async () => {
    try{
        const connectionInstance = await mongoose.connect(`${process.env.MONGO_URI}/${MONGO_DB}`)
        console.log("MONGODB IS CONNECTED AT :", connectionInstance.connection.host)
    }catch(error){
        console.log("CONNECTION FAILED:",error)
        process.exit(1)
    }
}

export default database