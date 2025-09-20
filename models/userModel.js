const crypto = require('crypto')
const mongoose = require('mongoose');
const validator = require('validator');
const bcrypt = require('bcrypt');


const chatuserSchema = new mongoose.Schema({
    name:{
        type: String,
        required: [true, 'A user must have a name']
    },
    email:{
         type: String,
        required: [true, 'A user must have an email'],
        trim: true,
        unique: true,
        lowercase: true,
        validate: [validator.isEmail, 'please provide a valid email']
    },
    role:{
        type: String,
        enum: ['user','admin'],
        default: 'user'
        
    },
    password:{
        type: String,
        required: [true, 'A user must have a password'],
        minlength: [8, 'A users password must have more or equal than 8 characters'],
        select: false
    },
    passwordConfirm:{
        type: String,
        required: [true, 'A user must confirm password'],
        validate:{
                    message: 'Confrim password ({VALUE}) must be the same with the password',
                    validator: function(val){
                    //this only points to current doc on NEW document creation
                    return val === this.password; 
                }
                }
    },
    profilePic: { type: String } ,
    passwordChangedAt: Date,
    passwordResetToken: String,
    passwordResetExpires: Date,
    active:{
        type:Boolean,
        default: true,
        select: false
    }
});

//password encryption
chatuserSchema.pre('save', async function (next) {
    
    //only run this fuction if the password is not actually modified
    if(!this.isModified('password')) return next()

        //hash password with cost of 12
    this.password = await bcrypt.hash(this.password,12)

    //delete passwordConfirm field
    this.passwordConfirm = undefined;
    next()
});

chatuserSchema.methods.changePasswordAfter = function(JWTTimestamp){
    if(this.passwordChangedAt){
        const changedTimestamp = parseInt(this.passwordChangedAt.getTime() / 1000,10)
        console.log(changedTimestamp,JWTTimestamp);
        return JWTTimestamp < changedTimestamp
        
    }
    //False means Not changed
    return false
}

//generate password reset token
chatuserSchema.methods.createPasswordResetToken = function() {
    const resetToken = crypto.randomBytes(32).toString("hex");

    this.passwordResetToken = crypto.createHash("sha256")
    .update(resetToken)
    .digest("hex");

    this.passwordResetExpires = Date.now() + 10 * 60 * 1000;

    return resetToken;
}


const User = mongoose.model('chatUser',chatuserSchema);

module.exports = User;