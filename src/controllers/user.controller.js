import { asyncHandler } from "../utils/asyncHandler.js";
import {apiError} from "../utils/apiError.js"
import {User} from "../models/user.model.js"
import { uploadFile } from "../utils/fileUpload.js";
import { apiResponse } from "../utils/apiResponse.js";


const registerUser = asyncHandler(async (req, res) => {
     
    const {username,email,fullName,password} = req.body

    //validation

    if([username,email,fullName,password].some((field) =>
    field?.trim() === "")) {
        throw new apiError(400, "enter correct details")
    }

    //check if user already exists

     const existedUser = await User.findOne({
        $or : [{username}, {email}]
    })

    if(existedUser){
       throw new apiError(400, "user already exists")}
      
    // take url of files 

    // console.log(req.files)
    const avatarLocalPath = req.files?.avatar[0]?.path
    // const coverImageLocalPath = req.files?.coverImage[0]?.path

    let coverImageLocalPath;
    if (req.files && 
        Array.isArray(req.files.coverImage) && 
        req.files.coverImage.length > 0){
        coverImageLocalPath = req.files.coverImage[0].path       
    }

    if(!avatarLocalPath){
        throw new apiError(400, "req")
    }
     
      // upload file to cloudinary

    const avatar = await uploadFile(avatarLocalPath)
    const coverImage = await uploadFile(coverImageLocalPath)


    if(!avatar){
        throw new apiError(401, "avatar is required")
    }

    // create user entry in db

    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username:username.toLowerCase()
    })

    // check for user creation


    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if(!createdUser){
        throw new apiError(500, "failed to register user")
    }

    return res.status (201).json(
        new apiResponse(200, createdUser, "created user successfully")
    )

})

export {registerUser}