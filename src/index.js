import dotenv from 'dotenv'
import database from './db/index.js'

dotenv.config({path: './env'})

database()







// import express from "express"
// const app = express()

// (async() => {
//     try{
//         await mongoose.connect(`${process.env.MONGO_URI}/${MONGO_DB}`)
//         app.on("error", (error) => {
//             console.log("error:", error)
//             throw error
//         })

//         app.listen(process.env.PORT, () =>{
//             console.log(`server listening on port ${process.env.PORT}` )
//         })
//     } catch (error) {
//         console.log("error :", error)
//         throw err
//     }
// })()