import { asyncHandler } from "../utils/asyncHandler.js";
import { apiError } from "../utils/apiError.js"
import { User } from "../models/user.model.js"
import { uploadFile } from "../utils/fileUpload.js";
import { apiResponse } from "../utils/apiResponse.js";


const generateAccessAndRefreshToken = async (userId) => {
    try {
        const user = await User.findById(userId)
        // generate using func we created in user.model

        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        //asssign that refresh token to db using this 

        user.refreshToken = refreshToken
        // save in db
        await user.save({ validateBeforeSave: false })

        return { accessToken, refreshToken }


    } catch (error) {
        throw new apiError(500, "something went wrong while generating access and refresh token")
    }
}

const registerUser = asyncHandler(async (req, res) => {


    // get user details from frontend
    // validation - not empty
    // check if user already exists: username, email
    // check for images, check for avatar
    // upload them to cloudinary, avatar
    // create user object - create entry in db
    // remove password and refresh token field from response
    // check for user creation
    // return res


    const { username, email, fullName, password } = req.body

    //validation

    if ([username, email, fullName, password].some((field) =>
        field?.trim() === "")) {
        throw new apiError(400, "enter correct details")
    }

    //check if user already exists

    const existedUser = await User.findOne({
        $or: [{ username }, { email }]
    })

    if (existedUser) {
        throw new apiError(400, "user already exists")
    }

    // take url of files 

    // console.log(req.files)
    const avatarLocalPath = req.files?.avatar[0]?.path
    // const coverImageLocalPath = req.files?.coverImage[0]?.path

    let coverImageLocalPath;
    if (req.files &&
        Array.isArray(req.files.coverImage) &&
        req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path
    }

    if (!avatarLocalPath) {
        throw new apiError(400, "req")
    }

    // upload file to cloudinary

    const avatar = await uploadFile(avatarLocalPath)
    const coverImage = await uploadFile(coverImageLocalPath)


    if (!avatar) {
        throw new apiError(401, "avatar is required")
    }

    // create user entry in db

    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase()
    })

    // check for user creation


    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if (!createdUser) {
        throw new apiError(500, "failed to register user")
    }

    return res.status(201).json(
        new apiResponse(200, createdUser, "created user successfully")
    )

})

const loginUser = asyncHandler(async (req, res) => {

    // req body = data
    // login using email or username
    // check whether user exists or not
    // if yes check password
    // access and refresh token
    // send cookie


    const { username, email, password } = req.body

    if (!(username || email)) {
        throw new apiError(400, "username or password is required")
    }

    // check if user exists or not

    const user = await User.findOne({
        $or: [{ username }, { email }]
    })

    if (!user) {
        throw new apiError(401, "user doesn't exist")
    }

    // check whether password entered is right or wrong using isPasswordCorrect func in user.model
    // we used 'user' instead of 'User' because we created this function


    const validUser = await user.isPasswordCorrect(password)

    if (!validUser) {
        throw new apiError(401, "password is not correct")
    }

    // access and refresh token

    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(user._id)
    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    // send cookie

    const options = {
        httpOnly: true,
        secure: true
    }

    res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new apiResponse(
                200,
                {
                    user: loggedInUser, accessToken, refreshToken

                },
                "user logged in successfully"
            )
        )

})

const logoutUser = asyncHandler(async (req, res) => {

    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: undefined
            }
        },
        {
            new: true
        }
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    return res.status(200)
    .clearCookie("accessToken", accessToken, options)
    .clearCookie("refreshToken", refreshToken, options)
    .json(new apiResponse(200, {}, "user logged out successfully"))


})

export { registerUser, loginUser, logoutUser }