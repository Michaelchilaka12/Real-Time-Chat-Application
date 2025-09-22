const crypto = require('crypto');
const {promisify} = require('util');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const sendEmail = require('../utils/email')



const catchAsync = require('../utils/catchAsync')
const AppError = require('../utils/appError')
const User = require('../models/userModel');


const signToken = id =>{
    return jwt.sign({ id}, process.env.JWT_SECRET,{expiresIn:process.env.JWT_EXPIRES_IN})
}


// utils/createSendToken.js (for reusability)
const createSendToken = (user, statusCode, res,req) => {
  const token = signToken(user._id)

  const cookieOptions = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,          // cannot be accessed by JS
    secure: false,           // set true in production (with HTTPS)
    sameSite: "lax"          // or "none" + secure:true if frontend/backend are on diff domains
  };

  res.cookie('jwt', token, cookieOptions);

  // Hide password field
  user.password = undefined;

      // If request expects JSON (API call with axios/fetch/Postman)
    if (req.xhr || req.headers.accept.includes("application/json")) {
      return res.status(201).json({
        status: 'success',
    token,
    data: { user },
      });
    }
    

//   res.status(statusCode).json({
//     status: 'success',
//     token,
//     data: { user }
//   });
};




exports.signup = catchAsync( async (req, res,next) =>{
    const newUser =  await User.create({

        name: req.body.name,
        email: req.body.email,
        password: req.body.password,
        passwordConfirm: req.body.passwordConfirm,
        role:req.body.role,
    });
//using jwt to create a token for a new user
    createSendToken(newUser,201,res,req)
     // Otherwise render Pug (normal form submission)
    res.status(201).render("signup-success", {
      title: "Signup Successful",
      message: "Your account has been created successfully! Please log in.",
    });

    
    
        // ✅ Send email notification to user
        await sendEmail({
          email: newUser.email,
          subject: "Account Creation",
          message: `Hi ${newUser.name},\n\nYour account has been successfully created.\n\n- Project Tracker Team`,
        });
    
        const admins = await User.find({role:"admin"});
        const adminEmails = admins.map(admin => admin.email);
        // ✅ Send email notification to admin
        await sendEmail({
          email: adminEmails,
          subject: "User Activity Notification",
          message: `User ${newUser.name} (ID: ${newUser._id}) just created an account now!.`,
        });
    
    

});


//login
exports.login = catchAsync( async(req,res,next) =>{
        const {email,password} = req.body;

        //check if email and password exists
        if(!email || !password){
            res.status(404).json({
                status:'fail',
                message: 'email and password does not exist'
            });
        }
        //check if user exists && password is correct
        const user = await User.findOne({email}).select('+password');
        
        if(!user){
             return res.status(404).json({
                status:'fail',
                message:' Invalid email or password'
            })
        }
        //to compare the passwords
        const isMatch = await bcrypt.compare(password,user.password);
        if(!isMatch){
            return res.status(400).json({
                status: 'fail',
                message: ' Invalid email or password'
            })
        }

        createSendToken(user,200,res,req)

        res.status(201).render("signup-success", {
      title: "Login Successful",
      message: "You are logged in successfully!.",
    });
    
});


exports.logout = (req,res) =>{
    res.clearCookie("jwt");
    res.json({
        status:'success',
        message:'Logged Out successfully'
    })
};


exports.restrictTo = (...roles)=>{
    return (req,res,next)=>{
        //roles is an array['admin','lead-guide']
        if(!roles.includes(req.user.role)){
            
            
            return next(new AppError('you do not have permission to perform this action',403))
        }
         next();
    }
   
}


exports.forgotPassword = catchAsync(async (req,res,next)=>{
    const user = await User.findOne({email: req.body.email});
    if(!user){
        return next (new AppError('There is no user with email address.',404))
    }

    //generate token
    const resetToken = user.createPasswordResetToken();
    await user.save({validateBeforeSave:false});

    //send email
    const resetURL = `${req.protocol}://${req.get("host")}/api/v1/users/resetPassword/${resetToken}`;
    const message = `Forgot your password? Submit a PATCH request with your new password to: ${resetURL}.\nIf you didn't request this, please ignore this email.`
    try {
        await sendEmail({
        email:user.email,
        subject: 'your password reset token (valid for 10 min)',
        message
     });
     res.status(200).json({
        status: 'success',
        message: 'token sent to email!'
     })
    } catch (err) {
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        await user.save({validateBeforeSave: false});

        return next(new AppError('There was an error sending the email. Try again later!'),500)
    }
});


exports.resetPassword = catchAsync(async (req,res,next)=>{
    //get user based on the token
    const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');

    const user = await User.findOne({passwordResetToken:hashedToken,passwordResetExpires: {$gt: Date.now()}});

    //if token is not expired, and there is user, set the new password
    if(!user){
        return next(new AppError('Token is invaild or has expired',400))
    }

    //setting values
    user.password = req.body.password
    user.passwordConfirm = req.body.passwordConfirm
    user.passwordResetToken = undefined
    user.passwordResetExpires = undefined
    user.passwordChangedAt = new Date().toISOString().split("T")[0];

    await user.save()
    //update changePasswordAt property for the user


    //log the user in and sent JWT
    createSendToken(user,200,res)
});

//how to protect routes using a middleware
exports.protect = catchAsync( async(req,res,next)=>{
    //1) getting the token and check if it's there

    let token;
    if(req.headers.authorization && req.headers.authorization.startsWith('Bearer')){    
        token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies.jwt){
        token = req.cookies.jwt;
    }
   
 
    
    if(!token){
        return next(new AppError('You are not logged in! please log in to get access.', 401))
    }
    //2)verification token
    const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET)
    
    
    //3) check if user still exists
    const currentUser = await User.findById(decoded.id);
    if(!currentUser){
        return next(new AppError('The user no longer exist.',401))
    }

//     //4) check if user changed password after the token was issued
//    if (currentUser.changePasswordAfter(decoded.iat)){
//     return next(new AppError('User recently changed password! Please log in again.',401))
//    };

   //grant access to protected route
   req.user = currentUser;
    next();
})

//for pug to know if a user is login, ans is only for rendered pages, no errors
exports.isLoggedIn = catchAsync( async(req,res,next)=>{
  
   if (req.cookies.jwt){
        
    
   
 
    
    
    //1)verify token
    const decoded = await promisify(jwt.verify)(req.cookies.jwt, process.env.JWT_SECRET)
    
    
    //2) check if user still exists
    const currentUser = await User.findById(decoded.id);
    if(!currentUser){
        return next()
    }

    //3) check if user changed password after the token was issued
   if (currentUser.changePasswordAfter(decoded.iat)){
    return next()
   };

   //there is a logged in user
   res.locals.user = currentUser //- this is how to pass a veriable to your template using locals
    return next();
}
next()
});





exports.renderLogin = (req, res) => {
  res.render("login");
};

exports.renderSignup = (req, res) => {
  res.render("signup");
};

exports.renderChat = (req,res) =>{
    res.render("chat")
}


exports.renderProfile = (req,res) =>{
    res.render("profilePic")
}

exports.renderUpdate =(req,res) =>{
    res.render("update")
}