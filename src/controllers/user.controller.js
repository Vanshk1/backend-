import { asyncHandler } from "../utils/asyncHandler.js";
import { apiError } from "../utils/apiError.js"
import { User } from "../models/user.model.js"
import { uploadFile } from "../utils/fileUpload.js";
import { apiResponse } from "../utils/apiResponse.js";
import jwt from "jsonwebtoken"
import mongoose from "mongoose";


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
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(new apiResponse(200, {}, "user logged out successfully"))


})

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if (!incomingRefreshToken) {
        throw new apiError(401, "unauthorized access")
    }

    try {
        const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET)

        const user = await User.findById(decodedToken?._id)

        if (!user) {
            throw new apiError(401, "invalid refresh token")
        }
        // verify whether incoming refresh token is equal to the stored refresh token 
        if (incomingRefreshToken !== user?.refreshToken) {
            throw new apiError(401, "refresh token is expired or used")
        }

        const options = {
            httpOnly: true,
            secure: true
        }

        const { accessToken, newRefreshToken } = await generateAccessAndRefreshToken(user._id)

        return res
            .status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", newRefreshToken, options)
            .json(
                new apiResponse(
                    200,
                    { accessToken, refreshToken: newRefreshToken },
                    "access token refreshed"

                )
            )
    } catch (error) {
        throw new apiError(400, error?.message || "invalid refresh token")
    }

})

const changeCurrentPassword = asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body

    // first user would be loggedIn so we will find it by this : 

    const user = await User.findById(req.user?._id)

    // now check if password is correct or not 

    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

    if (!isPasswordCorrect) {
        throw new apiError(400, "invalid password")
    }

    // upadate new password in db

    user.password = newPassword

    // save in db

    await user.save({ validateBeforeSave: false })

    return res
        .status(200)
        .json(
            new apiResponse(200, {}, "password changed successfully")
        )

})

const getCurrentUser = asyncHandler(async (req, res) => {
    return res
        .status(200)
        .json(new apiResponse(200, req.user, "user fetched successfully"))
})

const updateAccountDetails = asyncHandler(async (req, res) => {
    const { fullName, email } = req.body

    if (!(fullName || email)) {
        throw new apiError(400, "all fields are required")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullName,
                email: email      // either is fine
            }
        },
        { new: true }
    ).select("-password -refreshToken")

    return res
        .status(200)
        .json(new apiResponse(200, user, "user updated successfully"))
})

const updateUserAvatar = asyncHandler(async (req, res) => {
    const avatarLocalPath = req.file?.path

    if (!avatarLocalPath) {
        throw new apiError(400, "avatar file is missing")
    }

    // upload on cloudinary

    const avatar = await uploadFile(avatarLocalPath)

    if (!avatar) {
        throw new apiError(500, "avatar not uploaded")
    }

    // update in db

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                avatar: avatar.url
            }
        }, { new: true }
    ).select("-password -refreshToken")

    return res
        .status(200)
        .json(new apiResponse(200, user, "avatar updated successfully "))
})

const updateUserCoverImage = asyncHandler(async (req, res) => {
    const CoverImageLocalPath = req.file?.path

    if (!coverImageLocalPath) {
        throw new apiError(400, "cover file is missing")
    }

    // upload on cloudinary

    const coverImage = await uploadFile(coverImageLocalPath)

    if (!coverImage) {
        throw new apiError(500, "avatar not uploaded")
    }

    // update in db

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                coverImage: coverImage.url
            }
        }, { new: true }
    ).select("-password -refreshToken")

    return res
        .status(200)
        .json(new apiResponse(200, user, "coverImage updated successfully"))
})

const getUserChannelProfile = asyncHandler(async (req, res) => {
    // take username from the url eg youtube.com/vanshk1
    const { username } = req.params

    if (!username?.trim()) {
        throw new apiError(400, "user is missing")
    }

    // first use $match which is similar to find()
    const channel = await User.aggregate([{
        $match: {
            username: username?.toLowerCase()
        }
    },
    {
        // lookup is basically joins
        $lookup: {
            from: "subscriptions",    // bcoz mongodb converts name to small and adds an s
            localField: "_id",
            foreignField: "channel",  // to get subscribers use channels
            as: "subscribers"
        }

    },
    // another pipeline for how many channels user has subscribed
    {
        $lookup: {
            from: "subscriptions",
            localField: "_id",
            foreignField: "subscriber",
            as: "subscribedTo"
        }

    },
    // now we need to count how many subscribers channel has for that we'll use another pipeline
    {
        $addFields: {                // creates a new field 
            subscribersCount: {
                $size: "$subscribers"    // size gives the count 
            },
            channelsSubscribedToCount: {
                $size: "$subscribedTo"
            },
            // to let user know whether channel is subscribed or not
            isSubscribed: {
                $cond: {           // takes if then else
                    if: {$in: [req.user?._id, "$subscribers.subscriber"]},  // $in means whether  something is present or not takes an array
                    then: true,
                    else: false
                }
            }
        }
    },
    {
        $project: {      // displays only what we need to show 
            fullName: 1,
            username: 1,
            subscribersCount: 1,
            channelsSubscribedToCount: 1,
            isSubscribed: 1,
            avatar: 1,
            coverImage: 1

        }
    }

    ])

    if (!channel?.length) {
        throw new apiError(404, "channel does not exist")
    }

    return res
    .status(200)
    .json(
        new apiResponse(200, channel[0], "user channel fetched successfully")
    )

})

const getWatchHistory = asyncHandler(async(req, res) => {
    const user = User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup: {
                from: "videos",
                localfield: "watchHistory",
                foreignfield: "_id",
                as: "watchHistory",
                pipeline: [              // to get user details from video model
                    {
                        $lookup: {
                            from: "users",
                            localfield: "owner",
                            foreignfield: "_id",
                            as: "owner",
                            pipeline: [{
                                $project: {
                                    username: 1,
                                    fullName: 1,
                                    avatar: 1
                                }
                            }]
                        }
                    },
                    {
                        $addFields: {
                            owner: {
                                $first: "$owner"    // gives the first element from the o/p array
                            }
                        }
                    }
                ]
            }
        }
    ])

    res
    .status(200)
    .json(
        new apiResponse(200, user[0].watchHistory, "watch history fetched successfully")
    )
})

export { registerUser, loginUser, logoutUser, refreshAccessToken, changeCurrentPassword, getCurrentUser, updateAccountDetails, updateUserAvatar, updateUserCoverImage, getUserChannelProfile, getWatchHistory }