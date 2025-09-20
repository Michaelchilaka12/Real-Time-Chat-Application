const nodemailer = require('nodemailer');
const { options } = require('../app');




const sendEmail = async options =>{
    //create a transporter
    const transporter = nodemailer.createTransport({
        service: "gmail",
        auth:{
            user: process.env.EMAIL_USERNAME,
            pass: process.env.EMAIL_PASSWORD
        }
    });

    //define email options
    const mailOptions = {
        from: `"User Auth" <${process.env.EMAIL_USERNAME}>`,
        to: options.email,
        subject: options.subject,
        text: options.message
    }

    //actually the mail
    await transporter.sendMail(mailOptions)
}

module.exports = sendEmail;