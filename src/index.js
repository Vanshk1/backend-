import dotenv from 'dotenv'
import database from './db/index.js'
import { app } from './app.js'

dotenv.config({path: './env'})

database()
.then(() => {
    app.listen(process.env.PORT || 8000, () => {
        console.log(`server is listening on port : ${process.env.PORT}`)
    })
})
.catch((error) => {
    console.log("connection failed", error)
})







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