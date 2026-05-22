import { asyncHandler } from "../utils/asyncHandler.js";
import {apiError} from "../utils/apiError.js"
import {User} from "../models/user.model.js"
import { uploadFile } from "../utils/fileUpload.js";
import { apiResponse } from "../utils/apiResponse.js";


const registerUser = asyncHandler(async (req, res) => {
    
    const {fullName, username, email, password } = req.body
    console.log("email:", email)
    
    //check for validation

    if([fullName, username, email, password].some((field) =>
    field?.trim() === "")){
        throw new apiError(400, "all fields are required")
    }
    // check if user already exists
    const existedUser = User.findOne({
        $or: [{username}, {email}]
    })
    if(existedUser){
        throw new apiError(409, "user with email or username already exists")
    }

    // check for avatar and coverImage

    const avatarLocalPath = req.files?.avatar[0]?.path
    const coverImageLocalPath = req.files?.coverImage[0]?.path

    if(!avatarLocalPath){
        throw new apiError(400, "avatar is required")
    }

    // upload files to cloudinary

    const avatar = await uploadFile(avatarLocalPath)
    const coverImage = await uploadFile(coverImageLocalPath)

    if (!avatar) {
        throw new apiError(400, "avatar is required")
    }

    // create user object and enter in db

    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        username: username.toLowerCase()
    })

    // check for user creation
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if(!createdUser){
        throw new apiError(500, "something went wrong")
    }

    return res.status(201).json(
        new apiResponse(200, createdUser, "user registered successfully")
    )
})

export {registerUser}